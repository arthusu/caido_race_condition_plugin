package main

import (
	"bufio"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type Target struct {
	Host string `json:"host"`
	Port int    `json:"port"`
	TLS  bool   `json:"tls"`
	SNI  string `json:"sni"`
}

type Req struct { Raw string `json:"raw"` }

type RunPayload struct {
	Target    Target `json:"target"`
	Requests  []Req  `json:"requests"`
	TimeoutMs int    `json:"timeoutMs"`
}

type RunResult struct {
	OK                 bool   `json:"ok"`
	Message            string `json:"message,omitempty"`
	RTT                int64  `json:"rtt,omitempty"`
	Count              int    `json:"count,omitempty"`
	PipelineDetected   int    `json:"pipelineDetected,omitempty"`
	Note               string `json:"note,omitempty"`
	RawRequestCombined string `json:"rawRequestCombined,omitempty"`
	RawResponse        string `json:"rawResponse,omitempty"`
}

type EachResult struct {
	OK          bool   `json:"ok"`
	Idx         int    `json:"idx"`
	RTT         int64  `json:"rtt,omitempty"`
	StatusLine  string `json:"statusLine,omitempty"`
	RawRequest  string `json:"rawRequest,omitempty"`
	RawResponse string `json:"rawResponse,omitempty"`
	Error       string `json:"error,omitempty"`
}

type RunParallelResult struct {
	OK       bool         `json:"ok"`
	Message  string       `json:"message,omitempty"`
	Count    int          `json:"count,omitempty"`
	Results  []EachResult `json:"results,omitempty"`
	Combined string       `json:"combined,omitempty"`
}

func cors(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	cors(w); w.Header().Set("Content-Type","application/json")
	io.WriteString(w, `{"ok":true,"agent":"rcsp-h1","version":"2.1.0"}`)
}

func sse(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "text/event-stream")
	flusher, ok := w.(http.Flusher); if !ok { http.Error(w,"no sse",500); return }
	fmt.Fprintf(w, "event: hello\ndata: rcsp-h1-agent 2.1.0\n\n"); flusher.Flush()
	t := time.NewTicker(15 * time.Second); defer t.Stop()
	for {
		select {
		case <-r.Context().Done(): return
		case <-t.C: fmt.Fprintf(w, ": ping\n\n"); flusher.Flush()
		}
	}
}

func normalizeRaw(raw string) string {
	raw = strings.ReplaceAll(raw, "\r\n", "\n")
	raw = strings.ReplaceAll(raw, "\n", "\r\n")
	if !strings.HasSuffix(raw, "\r\n\r\n") { raw += "\r\n\r\n" }
	return raw
}

func dial(target Target, timeout time.Duration) (net.Conn, error) {
	dialer := &net.Dialer{Timeout: timeout}
	addr := fmt.Sprintf("%s:%d", target.Host, target.Port)
	if target.TLS {
		conf := &tls.Config{ServerName: target.SNI}
		return tls.DialWithDialer(dialer, "tcp", addr, conf)
	}
	return dialer.Dial("tcp", addr)
}

func runSingleWrite(w http.ResponseWriter, r *http.Request) {
	cors(w)
	if r.Method == http.MethodOptions { w.WriteHeader(204); return }
	w.Header().Set("Content-Type","application/json")

	var p RunPayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil { json.NewEncoder(w).Encode(RunResult{OK:false, Message:"bad json"}); return }
	if len(p.Requests)<1 { json.NewEncoder(w).Encode(RunResult{OK:false, Message:"no requests"}); return }
	if p.Target.Host=="" || p.Target.Port==0 { json.NewEncoder(w).Encode(RunResult{OK:false, Message:"bad target"}); return }
	timeout := time.Duration(p.TimeoutMs)*time.Millisecond; if timeout<=0 { timeout=10*time.Second }

	var b strings.Builder
	for _, rq := range p.Requests { b.WriteString(normalizeRaw(rq.Raw)) }
	combined := b.String()

	start := time.Now()
	conn, err := dial(p.Target, timeout)
	if err != nil { json.NewEncoder(w).Encode(RunResult{OK:false, Message:"dial error: "+err.Error()}); return }
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(timeout))
	if tcp, ok := conn.(*net.TCPConn); ok { _ = tcp.SetNoDelay(true) }

	if _, err := io.WriteString(conn, combined); err != nil {
		json.NewEncoder(w).Encode(RunResult{OK:false, Message:"write error: "+err.Error()}); return
	}

	reader := bufio.NewReader(conn)
	var sb strings.Builder; buf := make([]byte, 4096)
	for {
		n, er := reader.Read(buf); if n>0 { sb.Write(buf[:n]) }
		if er != nil {
			if er != io.EOF {}
			break
		}
	}
	rtt := time.Since(start).Milliseconds()
	rawResp := sb.String()
	pd := strings.Count(rawResp, "HTTP/1.1 ") + strings.Count(rawResp, "HTTP/1.0 ")
	note := ""
	if pd < len(p.Requests) { note = fmt.Sprintf("pipelining_rejected: got %d responses for %d requests", pd, len(p.Requests)) }
	json.NewEncoder(w).Encode(RunResult{OK:true, RTT:rtt, Count:len(p.Requests), PipelineDetected: pd, Note:note, RawRequestCombined: combined, RawResponse: rawResp})
}

func runParallel(w http.ResponseWriter, r *http.Request) {
	cors(w)
	if r.Method == http.MethodOptions { w.WriteHeader(204); return }
	w.Header().Set("Content-Type","application/json")

	var p RunPayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil { json.NewEncoder(w).Encode(RunParallelResult{OK:false, Message:"bad json"}); return }
	if len(p.Requests)<1 { json.NewEncoder(w).Encode(RunParallelResult{OK:false, Message:"no requests"}); return }
	if p.Target.Host=="" || p.Target.Port==0 { json.NewEncoder(w).Encode(RunParallelResult{OK:false, Message:"bad target"}); return }
	timeout := time.Duration(p.TimeoutMs)*time.Millisecond; if timeout<=0 { timeout=10*time.Second }

	results := make([]EachResult, len(p.Requests))
	var wg sync.WaitGroup
	wg.Add(len(p.Requests))
	for i, rq := range p.Requests {
		go func(idx int, rawIn string) {
			defer wg.Done()
			raw := normalizeRaw(rawIn)
			start := time.Now()
			conn, err := dial(p.Target, timeout)
			if err != nil { results[idx] = EachResult{OK:false, Idx:idx, Error:"dial: "+err.Error(), RawRequest: raw}; return }
			defer conn.Close()
			_ = conn.SetDeadline(time.Now().Add(timeout))
			if tcp, ok := conn.(*net.TCPConn); ok { _ = tcp.SetNoDelay(true) }
			if _, err := io.WriteString(conn, raw); err != nil { results[idx] = EachResult{OK:false, Idx:idx, Error:"write: "+err.Error(), RawRequest: raw}; return }

			reader := bufio.NewReader(conn)
			var sb strings.Builder; buf := make([]byte, 4096)
			for {
				n, er := reader.Read(buf); if n>0 { sb.Write(buf[:n]) }
				if er != nil {
					if er != io.EOF {}
					break
				}
			}
			el := time.Since(start).Milliseconds()
			resp := sb.String()
			// best-effort status line
			status := ""
			if p := strings.Index(resp, "\r\n"); p>0 { status = resp[:p] }
			results[idx] = EachResult{OK:true, Idx:idx, RTT:el, StatusLine:status, RawRequest: raw, RawResponse: resp}
		}(i, rq.Raw)
	}
	wg.Wait()

	out := RunParallelResult{OK:true, Count: len(results), Results: results}
	json.NewEncoder(w).Encode(out)
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/run", runSingleWrite)
	mux.HandleFunc("/run_parallel", runParallel)
	mux.HandleFunc("/logs", sse)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		cors(w); fmt.Fprintf(w, "rcsp-h1-agent 2.1.0\n")
	})
	s := &http.Server{Addr:"127.0.0.1:8766", Handler:mux}
	log.Printf("rcsp-h1-agent listening on %s\n", s.Addr)
	if err := s.ListenAndServe(); err != nil && err != http.ErrServerClosed { log.Fatalf("listen: %v", err) }
}
