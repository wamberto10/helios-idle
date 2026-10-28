"""HELIOS IDLE — servidor local sem cache.

Uso: python tools/servidor.py [porta]   (padrão 8765; serve a pasta do jogo)
Envia "Cache-Control: no-cache" para o navegador sempre conferir se os arquivos mudaram:
assim uma versão nova do jogo aparece com um simples recarregar da página.
"""
import functools
import http.server
import os
import sys


class SemCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


def main():
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    pasta = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    handler = functools.partial(SemCache, directory=pasta)
    http.server.ThreadingHTTPServer.allow_reuse_address = False
    with http.server.ThreadingHTTPServer(('', porta), handler) as srv:
        print(f'HELIOS IDLE em http://localhost:{porta}  (Ctrl+C para encerrar)')
        srv.serve_forever()


if __name__ == '__main__':
    main()
