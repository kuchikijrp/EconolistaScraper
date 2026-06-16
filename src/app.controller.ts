import { Controller, Get, Post, Body, UnauthorizedException, Header } from '@nestjs/common';
import { AppService } from './app.service';
import { IN_MEMORY_LOGS } from './logger/memory.logger';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  @Header('Content-Type', 'text/html')
  getDashboard() {
    let html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>EconoLista - Live Console</title>
          <style>
            :root {
              --bg: #0f172a;
              --surface: #1e293b;
              --text: #f8fafc;
              --text-muted: #94a3b8;
              --border: #334155;
              --log: #38bdf8;
              --error: #ef4444;
              --warn: #f59e0b;
              --debug: #a855f7;
            }
            body { 
              font-family: 'Inter', system-ui, sans-serif; 
              background-color: var(--bg); 
              color: var(--text); 
              margin: 0; 
              padding: 2rem; 
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 2rem;
              padding-bottom: 1rem;
              border-bottom: 1px solid var(--border);
            }
            .header h1 {
              margin: 0;
              font-size: 1.5rem;
              font-weight: 600;
              display: flex;
              align-items: center;
              gap: 0.5rem;
            }
            .pulse {
              width: 10px;
              height: 10px;
              background-color: #22c55e;
              border-radius: 50%;
              box-shadow: 0 0 10px #22c55e;
              animation: pulse 1.5s infinite;
            }
            @keyframes pulse {
              0% { transform: scale(0.95); opacity: 0.8; }
              50% { transform: scale(1.1); opacity: 1; }
              100% { transform: scale(0.95); opacity: 0.8; }
            }
            .btn-reprocess {
              background: var(--warn);
              color: #0f172a;
              border: none;
              padding: 0.6rem 1.2rem;
              border-radius: 6px;
              font-weight: 700;
              cursor: pointer;
              transition: all 0.2s;
              font-family: inherit;
              display: flex;
              align-items: center;
              gap: 0.5rem;
            }
            .btn-reprocess:hover {
              filter: brightness(1.1);
              transform: translateY(-1px);
            }
            .terminal {
              background: var(--surface);
              border-radius: 12px;
              border: 1px solid var(--border);
              box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
              overflow: hidden;
            }
            .terminal-header {
              background: #0f172a;
              padding: 0.75rem 1rem;
              display: flex;
              gap: 0.5rem;
              border-bottom: 1px solid var(--border);
            }
            .dot { width: 12px; height: 12px; border-radius: 50%; }
            .dot.red { background: #ff5f56; }
            .dot.yellow { background: #ffbd2e; }
            .dot.green { background: #27c93f; }
            
            table { width: 100%; border-collapse: collapse; font-family: 'JetBrains Mono', 'Courier New', Courier, monospace; font-size: 0.9rem; }
            th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border); }
            th { background-color: rgba(0,0,0,0.2); color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.75rem; }
            tr:hover { background-color: rgba(255,255,255,0.03); }
            tr:last-child td { border-bottom: none; }
            
            .badge {
              padding: 0.2rem 0.5rem;
              border-radius: 4px;
              font-size: 0.75rem;
              font-weight: 600;
              letter-spacing: 0.05em;
            }
            .level-LOG { color: var(--log); background: rgba(56, 189, 248, 0.1); }
            .level-ERROR { color: var(--error); background: rgba(239, 68, 68, 0.1); }
            .level-WARN { color: var(--warn); background: rgba(245, 158, 11, 0.1); }
            .level-DEBUG { color: var(--debug); background: rgba(168, 85, 247, 0.1); }
            
            .context { color: var(--text-muted); font-size: 0.8rem; }
            .message { color: #e2e8f0; }
            .timestamp { color: var(--text-muted); font-size: 0.8rem; white-space: nowrap; }
            
            .json-block {
              background: rgba(0, 0, 0, 0.25);
              padding: 0.75rem;
              border-radius: 6px;
              margin: 0.25rem 0;
              font-family: 'JetBrains Mono', 'Courier New', Courier, monospace;
              font-size: 0.8rem;
              white-space: pre-wrap;
              word-break: break-all;
              color: #a7f3d0;
              max-height: 150px;
              overflow-y: auto;
              border: 1px solid rgba(255, 255, 255, 0.05);
            }
            .json-block::-webkit-scrollbar { width: 6px; }
            .json-block::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1><div class="pulse"></div> Live Console</h1>
              <span style="color: var(--text-muted); font-size: 0.9rem;">Auto-refreshing every 5s</span>
            </div>
            <button onclick="reprocessDlq()" class="btn-reprocess">
              🔄 Reprocessar DLQ
            </button>
          </div>
          
          <div class="terminal">
            <div class="terminal-header">
              <div class="dot red"></div>
              <div class="dot yellow"></div>
              <div class="dot green"></div>
            </div>
            <table>
              <thead>
                <tr>
                  <th width="150">Timestamp</th>
                  <th width="100">Level</th>
                  <th width="150">Context</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
    `;

    if (IN_MEMORY_LOGS.length === 0) {
      html += `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 3rem;">Nenhum log registrado ainda...</td></tr>`;
    }

    for (const log of IN_MEMORY_LOGS) {
      const time = new Date(log.timestamp).toLocaleString('pt-BR', { hour12: false });

      let msgHtml = '';
      if (typeof log.message === 'object') {
        msgHtml = `<pre class="json-block">${JSON.stringify(log.message, null, 2)}</pre>`;
      } else {
        msgHtml = String(log.message);
      }

      html += `
        <tr>
          <td class="timestamp">${time}</td>
          <td><span class="badge level-${log.level}">${log.level}</span></td>
          <td class="context">[${log.context}]</td>
          <td class="message">${msgHtml}</td>
        </tr>
      `;
    }

    html += `
              </tbody>
            </table>
          </div>

          <script>
            let isPromptOpen = false;
            
            setTimeout(() => {
              if (!isPromptOpen) {
                window.location.reload();
              }
            }, 5000);

            async function reprocessDlq() {
              isPromptOpen = true;
              const pwd = prompt("Digite a senha de administrador (padrão: admin123):");
              isPromptOpen = false;
              
              if (!pwd) {
                setTimeout(() => window.location.reload(), 5000);
                return;
              }

              try {
                const res = await fetch('/reprocess-dlq', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ password: pwd })
                });
                
                const data = await res.json();
                if (res.ok) {
                  alert("✅ Sucesso! " + data.count + " notas reenviadas para a fila principal.");
                } else {
                  alert("❌ Erro: " + data.message);
                }
              } catch (e) {
                alert("Erro ao conectar ao servidor.");
              }
              window.location.reload();
            }
          </script>
        </body>
      </html>
    `;

    return html;
  }

  @Post('reprocess-dlq')
  async reprocessDlqEndpoint(@Body() body: { password?: string }) {
    const expectedPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (body.password !== expectedPassword) {
      throw new UnauthorizedException('Senha incorreta');
    }

    const result = await this.appService.reprocessDeadLetters();
    return { success: true, count: result.count };
  }
}
