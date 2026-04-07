/**
 * matricula-popup.js
 * Popup de matrícula com integração Google Sheets + RD Station CRM
 * Página: abertura-de-classe (Cidade Tiradentes — Básico em Teologia)
 *
 * Como configurar:
 *  1. Substitua GOOGLE_SHEETS_WEBHOOK_URL pela URL gerada no Apps Script
 *  2. Substitua RD_STATION_TOKEN pelo seu token da API do RD Station CRM
 *  3. Suba este arquivo no servidor (ele NÃO será sobrescrito pelo admin)
 *  4. Adicione no <body> da página: <script src="/matricula-popup.js"></script>
 */

// ============================================================
// ⚙️  CONFIGURAÇÕES — edite apenas aqui
// ============================================================
const CONFIG = {
  googleSheetsWebhookUrl: 'COLE_AQUI_A_URL_DO_APPS_SCRIPT',
  rdStationToken: 'SEU_TOKEN_DO_RD_STATION_CRM',
  whatsappNumero: '5511999999999', // número com DDI+DDD, sem espaços
  mensagensCurso: {
    basico:   'Olá! Tenho interesse no curso *Básico em Teologia* (Cidade Tiradentes). Gostaria de mais informações.',
    medio:    'Olá! Tenho interesse no curso *Médio em Teologia*. Gostaria de mais informações.',
    bacharel: 'Olá! Tenho interesse no curso *Bacharel em Teologia*. Gostaria de mais informações.',
  },
  mensagemPadrao: 'Olá! Tenho interesse em um curso de Teologia. Gostaria de mais informações.'
};

// ============================================================
// 💉  ESTILOS DO POPUP (injetados automaticamente)
// ============================================================
(function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    #mk-overlay {
      display: none;
      position: fixed; inset: 0;
      background: rgba(16, 40, 78, 0.72);
      z-index: 9998;
      animation: mkFadeIn 0.25s ease;
    }
    @keyframes mkFadeIn { from { opacity:0 } to { opacity:1 } }

    #mk-popup {
      display: none;
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: #fff;
      border-radius: 16px;
      padding: 2.5rem 2rem;
      width: min(92vw, 440px);
      z-index: 9999;
      box-shadow: 0 24px 64px rgba(16,40,78,0.22);
      animation: mkSlideUp 0.3s ease;
    }
    @keyframes mkSlideUp {
      from { transform: translate(-50%, -44%); opacity: 0; }
      to   { transform: translate(-50%, -50%); opacity: 1; }
    }

    #mk-popup h2 {
      font-family: Inter, sans-serif;
      font-size: 1.4rem;
      color: #10284E;
      margin: 0 0 0.4rem;
      font-weight: 800;
    }
    #mk-popup p {
      font-family: Inter, sans-serif;
      font-size: 0.92rem;
      color: #555;
      margin: 0 0 1.5rem;
    }
    #mk-popup label {
      font-family: Inter, sans-serif;
      font-size: 0.82rem;
      font-weight: 600;
      color: #10284E;
      display: block;
      margin-bottom: 0.3rem;
    }
    #mk-popup input {
      width: 100%;
      padding: 0.72rem 1rem;
      border: 1.5px solid #E2E8F0;
      border-radius: 8px;
      font-family: Inter, sans-serif;
      font-size: 0.95rem;
      margin-bottom: 1rem;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    #mk-popup input:focus { border-color: #10284E; }

    #mk-btn-submit {
      width: 100%;
      background: #10284E;
      color: #F5C400;
      border: none;
      border-radius: 8px;
      padding: 0.9rem;
      font-family: Inter, sans-serif;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }
    #mk-btn-submit:hover:not(:disabled) { background: #1a3d6b; }
    #mk-btn-submit:active { transform: scale(0.98); }
    #mk-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

    #mk-close {
      position: absolute;
      top: 1rem; right: 1.1rem;
      background: none; border: none;
      font-size: 1.5rem; cursor: pointer;
      color: #aaa; line-height: 1;
    }
    #mk-close:hover { color: #10284E; }

    #mk-msg-erro {
      color: #c0392b;
      font-size: 0.82rem;
      font-family: Inter, sans-serif;
      margin-top: -0.5rem;
      margin-bottom: 0.8rem;
      display: none;
    }
    #mk-badge-curso {
      display: inline-block;
      background: #F5C400;
      color: #10284E;
      font-family: Inter, sans-serif;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 0.25rem 0.7rem;
      border-radius: 999px;
      margin-bottom: 0.8rem;
    }
  `;
  document.head.appendChild(style);
})();

// ============================================================
// 🏗️  ESTRUTURA HTML DO POPUP
// ============================================================
(function buildPopup() {
  document.body.insertAdjacentHTML('beforeend', `
    <div id="mk-overlay"></div>
    <div id="mk-popup" role="dialog" aria-modal="true" aria-labelledby="mk-titulo">
      <button id="mk-close" aria-label="Fechar">✕</button>
      <span id="mk-badge-curso"></span>
      <h2 id="mk-titulo">Garanta sua vaga!</h2>
      <p>Preencha seus dados e entraremos em contato pelo WhatsApp.</p>

      <label for="mk-nome">Nome completo *</label>
      <input id="mk-nome" type="text" placeholder="Seu nome" autocomplete="name" />

      <label for="mk-email">E-mail *</label>
      <input id="mk-email" type="email" placeholder="seu@email.com" autocomplete="email" />

      <label for="mk-whatsapp">WhatsApp *</label>
      <input id="mk-whatsapp" type="tel" placeholder="(11) 99999-9999" autocomplete="tel" />

      <div id="mk-msg-erro">Por favor, preencha todos os campos corretamente.</div>

      <button id="mk-btn-submit">Quero minha vaga →</button>
    </div>
  `);
})();

// ============================================================
// 🔧  LÓGICA PRINCIPAL
// ============================================================
(function init() {
  let cursoAtual = 'basico'; // padrão para esta página

  // --- Abre o popup ---
  function abrirPopup(curso) {
    cursoAtual = curso || 'basico';
    const nomes = {
      basico:   'Básico em Teologia',
      medio:    'Médio em Teologia',
      bacharel: 'Bacharel em Teologia'
    };
    document.getElementById('mk-badge-curso').textContent = nomes[cursoAtual] || nomes.basico;
    document.getElementById('mk-msg-erro').style.display = 'none';
    document.getElementById('mk-btn-submit').disabled = false;
    document.getElementById('mk-btn-submit').textContent = 'Quero minha vaga →';
    document.getElementById('mk-overlay').style.display = 'block';
    document.getElementById('mk-popup').style.display = 'block';
    setTimeout(() => document.getElementById('mk-nome').focus(), 50);
  }

  // --- Fecha o popup ---
  function fecharPopup() {
    document.getElementById('mk-overlay').style.display = 'none';
    document.getElementById('mk-popup').style.display = 'none';
    ['mk-nome','mk-email','mk-whatsapp'].forEach(id => document.getElementById(id).value = '');
  }

  // --- Clique nos botões de matrícula ---
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn-card-primary, .wa-btn, [data-matricula]');
    if (!btn) return;
    e.preventDefault();
    const curso = btn.dataset.curso || 'basico';
    abrirPopup(curso);
  });

  // --- Fecha ao clicar no overlay ou no X ---
  document.getElementById('mk-overlay').addEventListener('click', fecharPopup);
  document.getElementById('mk-close').addEventListener('click', fecharPopup);

  // --- Fecha com ESC ---
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharPopup(); });

  // --- Submissão do formulário ---
  document.getElementById('mk-btn-submit').addEventListener('click', async function() {
    const nome     = document.getElementById('mk-nome').value.trim();
    const email    = document.getElementById('mk-email').value.trim();
    const whatsapp = document.getElementById('mk-whatsapp').value.trim();
    const erroEl   = document.getElementById('mk-msg-erro');

    // Validação básica
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!nome || !emailValido || whatsapp.length < 8) {
      erroEl.style.display = 'block';
      return;
    }
    erroEl.style.display = 'none';

    const btn = document.getElementById('mk-btn-submit');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
      // 1) Envia para o Google Sheets
      await enviarGoogleSheets({ nome, email, whatsapp, curso: cursoAtual });

      // 2) Envia para o RD Station CRM (não bloqueia se falhar)
      enviarRDStation({ nome, email, whatsapp, curso: cursoAtual }).catch(console.warn);

    } catch (err) {
      console.warn('Erro ao salvar lead:', err);
      // Mesmo com erro, redireciona para o WhatsApp para não perder o lead
    }

    // 3) Redireciona para o WhatsApp
    redirecionarWhatsApp(cursoAtual, nome);
    fecharPopup();
  });

  // --------------------------------------------------------
  // 📊  Envio para Google Sheets via Apps Script
  // --------------------------------------------------------
  async function enviarGoogleSheets(dados) {
    if (!CONFIG.googleSheetsWebhookUrl || CONFIG.googleSheetsWebhookUrl.includes('COLE_AQUI')) {
      console.warn('Google Sheets: URL não configurada. Configure em matricula-popup.js');
      return;
    }
    await fetch(CONFIG.googleSheetsWebhookUrl, {
      method: 'POST',
      mode: 'no-cors', // Apps Script não envia CORS headers em doPost
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
  }

  // --------------------------------------------------------
  // 📬  Envio para RD Station CRM Free
  // --------------------------------------------------------
  async function enviarRDStation(dados) {
    if (!CONFIG.rdStationToken || CONFIG.rdStationToken.includes('SEU_TOKEN')) {
      console.warn('RD Station: token não configurado.');
      return;
    }
    await fetch('https://crm.rdstation.com/api/v1/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': CONFIG.rdStationToken
      },
      body: JSON.stringify({
        contact: {
          name: dados.nome,
          emails: [{ email: dados.email }],
          phones: [{ phone: dados.whatsapp }],
          deal: { name: 'Interesse em ' + dados.curso }
        }
      })
    });
  }

  // --------------------------------------------------------
  // 📱  Redirecionamento para WhatsApp
  // --------------------------------------------------------
  function redirecionarWhatsApp(curso, nome) {
    const mensagemBase = CONFIG.mensagensCurso[curso] || CONFIG.mensagemPadrao;
    const mensagemFinal = mensagemBase + ' Me chamo ' + nome + '.';
    const url = 'https://wa.me/' + CONFIG.whatsappNumero + '?text=' + encodeURIComponent(mensagemFinal);
    window.open(url, '_blank');
  }
})();
