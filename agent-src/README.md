# rcsp-h1-agent 2.1.0
- `/run`  → intento de *single write* con todas las requests concatenadas.
- `/run_parallel` → abre N conexiones y lanza todas las requests a la vez; devuelve per‑request RAW y status.
