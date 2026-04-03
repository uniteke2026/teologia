/**
 * matricula-popup.js
 * Pop-up de captação de leads — Matrícula
 *
 * COMO USAR: adicione UMA linha antes do </body> no index.html:
 *   <script src="matricula-popup.js"></script>
 *
 * CONFIGURAÇÃO OBRIGATÓRIA (seção abaixo):
 *   1. RD_TOKEN     → sua API Key do RD Station CRM
 *   2. WHATSAPP_NUM → número com DDI+DDD, sem espaços ou símbolos
 *   3. WA_MESSAGE   → mensagem pré-preenchida no WhatsApp (opcional)
 */

/* ─────────────────────────────────────────────
   ★  CONFIGURAÇÕES — edite aqui
───────────────────────────────────────────── */
const POPUP_CONFIG = {
  RD_TOKEN:      'SEU_TOKEN_AQUI',          // Copie de: RD Station CRM → Configurações → Integrações → API
  WHATSAPP_NUM:  '5511999999999',           // Ex: 5511987654321 (55 = Brasil, 11 = DDD)
  CONVERSION_ID: 'Formulario de Matricula', // Nome da conversão que aparece no RD Station

  // Mensagens por curso — use o mesmo valor do data-curso="" no botão HTML
  CURSOS: {
    'basico':    'Olá! Vim do site e quero me matricular no Curso Básico em Teologia',
    'medio':     'Olá! Vim do site e quero me matricular no Curso Médio em Teologia',
    'bacharel':  'Olá! Vim do site e quero me matricular no Curso de Bacharel em Teologia',
    'default':   'Olá! Vim do site e gostaria de saber mais sobre as matrículas.'
  }
};

/* ─────────────────────────────────────────────
   ESTILOS — identidade visual do site
───────────────────────────────────────────── */
(function injectStyles() {
  const css = `
    /* ── Overlay ── */
    #mp-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: rgba(16, 40, 78, 0.55);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      align-items: center;
      justify-content: center;
      padding: 16px;
      animation: mp-fade-in 0.2s ease;
    }
    #mp-overlay.mp-visible {
      display: flex;
    }
    @keyframes mp-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    /* ── Modal ── */
    #mp-modal {
      background: #FFFFFF;
      border-radius: 16px;
      box-shadow: 0 24px 64px rgba(16,40,78,0.22);
      width: 100%;
      max-width: 440px;
      overflow: hidden;
      animation: mp-slide-up 0.28s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes mp-slide-up {
      from { opacity: 0; transform: translateY(32px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }

    /* ── Cabeçalho ── */
    #mp-header {
      background: #10284E;
      padding: 28px 28px 24px;
      position: relative;
    }
    #mp-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(245,196,0,0.15);
      border: 1px solid rgba(245,196,0,0.35);
      border-radius: 100px;
      padding: 4px 12px;
      margin-bottom: 12px;
    }
    #mp-badge span {
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #F5C400;
    }
    #mp-title {
      font-family: 'Inter', sans-serif;
      font-size: 22px;
      font-weight: 800;
      color: #FFFFFF;
      margin: 0 0 6px;
      line-height: 1.25;
    }
    #mp-subtitle {
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 400;
      color: rgba(255,255,255,0.65);
      margin: 0;
      line-height: 1.5;
    }
    #mp-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(255,255,255,0.1);
      border: none;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
      color: #fff;
      font-size: 18px;
      line-height: 1;
    }
    #mp-close:hover { background: rgba(255,255,255,0.2); }

    /* ── Corpo / Formulário ── */
    #mp-body {
      padding: 28px;
    }
    .mp-field {
      margin-bottom: 16px;
    }
    .mp-field label {
      display: block;
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: #10284E;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .mp-field input {
      width: 100%;
      height: 46px;
      border: 1.5px solid #E2E8F0;
      border-radius: 10px;
      padding: 0 14px;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      font-weight: 400;
      color: #10284E;
      background: #F4F5F7;
      outline: none;
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
      box-sizing: border-box;
    }
    .mp-field input::placeholder { color: #a0aab8; }
    .mp-field input:focus {
      border-color: #10284E;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(16,40,78,0.08);
    }
    .mp-field input.mp-error {
      border-color: #e53e3e;
      background: #fff5f5;
    }
    .mp-field-error {
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      color: #e53e3e;
      margin-top: 4px;
      display: none;
    }
    .mp-field.mp-has-error .mp-field-error { display: block; }

    /* ── Botão enviar ── */
    #mp-submit {
      width: 100%;
      height: 50px;
      background: #F5C400;
      color: #10284E;
      border: none;
      border-radius: 10px;
      font-family: 'Inter', sans-serif;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 8px;
      transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
      box-shadow: 0 4px 14px rgba(245,196,0,0.4);
    }
    #mp-submit:hover {
      background: #e6b800;
      box-shadow: 0 6px 20px rgba(245,196,0,0.5);
      transform: translateY(-1px);
    }
    #mp-submit:active { transform: translateY(0); }
    #mp-submit:disabled {
      opacity: 0.7;
      cursor: not-allowed;
      transform: none;
    }

    /* ── Spinner ── */
    .mp-spinner {
      width: 18px;
      height: 18px;
      border: 2.5px solid rgba(16,40,78,0.25);
      border-top-color: #10284E;
      border-radius: 50%;
      animation: mp-spin 0.6s linear infinite;
      display: none;
    }
    #mp-submit.mp-loading .mp-spinner { display: block; }
    #mp-submit.mp-loading .mp-btn-text { display: none; }
    @keyframes mp-spin {
      to { transform: rotate(360deg); }
    }

    /* ── Rodapé do modal ── */
    #mp-footer {
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      color: #6b6b6b;
      text-align: center;
      margin-top: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }

    /* ── Tela de sucesso ── */
    #mp-success {
      display: none;
      padding: 40px 28px;
      text-align: center;
    }
    #mp-success.mp-visible { display: block; }
    #mp-success-icon {
      width: 64px;
      height: 64px;
      background: rgba(245,196,0,0.12);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 28px;
    }
    #mp-success h3 {
      font-family: 'Inter', sans-serif;
      font-size: 20px;
      font-weight: 800;
      color: #10284E;
      margin: 0 0 8px;
    }
    #mp-success p {
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      color: #6b6b6b;
      margin: 0 0 24px;
      line-height: 1.55;
    }
    #mp-wa-redirect {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #25D366;
      color: #fff;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      font-weight: 700;
      padding: 13px 24px;
      border-radius: 10px;
      text-decoration: none;
      transition: background 0.15s, transform 0.1s;
      box-shadow: 0 4px 14px rgba(37,211,102,0.35);
    }
    #mp-wa-redirect:hover {
      background: #1fb558;
      transform: translateY(-1px);
    }

    /* ── Responsivo mobile ── */
    @media (max-width: 480px) {
      #mp-modal { border-radius: 14px 14px 0 0; }
      #mp-overlay { align-items: flex-end; padding: 0; }
    }
  `;
  const style = document.createElement('style');
  style.id = 'mp-styles';
  style.textContent = css;
  document.head.appendChild(style);
})();

/* ─────────────────────────────────────────────
   HTML DO MODAL
───────────────────────────────────────────── */
(function injectHTML() {
  const html = `
    <div id="mp-overlay" role="dialog" aria-modal="true" aria-labelledby="mp-title">
      <div id="mp-modal">

        <!-- Cabeçalho -->
        <div id="mp-header">
          <button id="mp-close" aria-label="Fechar">✕</button>
          <div id="mp-badge">
            <span>🎓 Processo de Matrícula</span>
          </div>
          <h2 id="mp-title">Garanta sua vaga!</h2>
          <p id="mp-subtitle">Preencha seus dados e nossa equipe entrará em contato para te orientar.</p>
        </div>

        <!-- Formulário -->
        <div id="mp-body">
          <form id="mp-form" novalidate>

            <div class="mp-field" id="field-nome">
              <label for="mp-nome">Nome completo</label>
              <input type="text" id="mp-nome" name="nome" placeholder="Seu nome completo" autocomplete="name" />
              <div class="mp-field-error">Por favor, informe seu nome.</div>
            </div>

            <div class="mp-field" id="field-email">
              <label for="mp-email">E-mail</label>
              <input type="email" id="mp-email" name="email" placeholder="seu@email.com" autocomplete="email" />
              <div class="mp-field-error">Informe um e-mail válido.</div>
            </div>

            <div class="mp-field" id="field-whatsapp">
              <label for="mp-whatsapp">WhatsApp</label>
              <input type="tel" id="mp-whatsapp" name="whatsapp" placeholder="(11) 99999-9999" autocomplete="tel" maxlength="16" />
              <div class="mp-field-error">Informe um número de WhatsApp válido.</div>
            </div>

            <button type="submit" id="mp-submit">
              <div class="mp-spinner"></div>
              <span class="mp-btn-text">Quero garantir minha vaga →</span>
            </button>

            <p id="mp-footer">
              🔒 Seus dados estão seguros e não serão compartilhados.
            </p>
          </form>

          <!-- Tela de sucesso -->
          <div id="mp-success">
            <div id="mp-success-icon">🎉</div>
            <h3>Recebemos seus dados!</h3>
            <p>Agora você será redirecionado ao nosso WhatsApp para concluir o processo de matrícula.</p>
            <a id="mp-wa-redirect" href="#" target="_blank" rel="noopener">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.528 5.845L.057 23.547a.75.75 0 00.916.916l5.702-1.471A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.722 9.722 0 01-4.964-1.362l-.356-.212-3.688.951.969-3.59-.232-.37A9.75 9.75 0 1112 21.75z"/>
              </svg>
              Continuar no WhatsApp
            </a>
          </div>
        </div>

      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
})();

/* ─────────────────────────────────────────────
   LÓGICA PRINCIPAL
───────────────────────────────────────────── */
(function initPopup() {

  const overlay   = document.getElementById('mp-overlay');
  const closeBtn  = document.getElementById('mp-close');
  const form      = document.getElementById('mp-form');
  const submitBtn = document.getElementById('mp-submit');
  const successEl = document.getElementById('mp-success');
  const waLink    = document.getElementById('mp-wa-redirect');

  // Guarda qual curso foi clicado
  let cursoAtivo = 'default';

  /* ── Abrir / fechar ── */
  function openPopup(curso) {
    cursoAtivo = curso || 'default';
    overlay.classList.add('mp-visible');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('mp-nome').focus(), 100);
  }

  function closePopup() {
    overlay.classList.remove('mp-visible');
    document.body.style.overflow = '';
    // reset após fechar
    setTimeout(resetForm, 300);
  }

  function resetForm() {
    form.reset();
    form.style.display = '';
    successEl.classList.remove('mp-visible');
    submitBtn.disabled = false;
    submitBtn.classList.remove('mp-loading');
    document.querySelectorAll('.mp-field').forEach(f => f.classList.remove('mp-has-error'));
    document.querySelectorAll('.mp-field input').forEach(i => i.classList.remove('mp-error'));
  }

  /* ── Interceptar cliques nos botões do site ── */
  document.addEventListener('click', function(e) {
    // Botão "Realizar Matrícula" (.btn-card-primary) — lê data-curso do botão
    const btnNavy = e.target.closest('.btn-card-primary');
    if (btnNavy) {
      e.preventDefault();
      openPopup(btnNavy.dataset.curso);
      return;
    }
    // Botão flutuante do WhatsApp (.wa-btn) — abre sem curso específico
    const waBtn = e.target.closest('.wa-btn');
    if (waBtn) {
      e.preventDefault();
      openPopup('default');
      return;
    }
  });

  /* ── Fechar ao clicar fora ou no X ── */
  closeBtn.addEventListener('click', closePopup);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closePopup();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closePopup();
  });

  /* ── Máscara do WhatsApp ── */
  document.getElementById('mp-whatsapp').addEventListener('input', function(e) {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) v = '(' + v.slice(0,2) + ') ' + v.slice(2,7) + '-' + v.slice(7);
    else if (v.length > 2) v = '(' + v.slice(0,2) + ') ' + v.slice(2);
    else if (v.length > 0) v = '(' + v;
    e.target.value = v;
  });

  /* ── Validação ── */
  function validate() {
    let ok = true;
    const nome     = document.getElementById('mp-nome');
    const email    = document.getElementById('mp-email');
    const whatsapp = document.getElementById('mp-whatsapp');

    // nome
    if (!nome.value.trim() || nome.value.trim().length < 3) {
      showError('field-nome', nome); ok = false;
    } else { clearError('field-nome', nome); }

    // email
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email.value.trim())) {
      showError('field-email', email); ok = false;
    } else { clearError('field-email', email); }

    // whatsapp (mínimo 14 chars com máscara: (11) 9999-9999)
    if (whatsapp.value.replace(/\D/g,'').length < 10) {
      showError('field-whatsapp', whatsapp); ok = false;
    } else { clearError('field-whatsapp', whatsapp); }

    return ok;
  }

  function showError(fieldId, input) {
    document.getElementById(fieldId).classList.add('mp-has-error');
    input.classList.add('mp-error');
  }
  function clearError(fieldId, input) {
    document.getElementById(fieldId).classList.remove('mp-has-error');
    input.classList.remove('mp-error');
  }

  /* ── Envio para RD Station CRM ── */
  async function sendToRDStation(data) {
    const payload = {
      event_type:   'CONVERSION',
      event_family: 'CDP',
      payload: {
        conversion_identifier: POPUP_CONFIG.CONVERSION_ID,
        name:         data.nome,
        email:        data.email,
        mobile_phone: data.whatsapp.replace(/\D/g,''),
        tags:         ['matricula', 'site']
      }
    };

    const response = await fetch('https://api.rd.services/platform/conversions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${POPUP_CONFIG.RD_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      // Salva localmente como backup se a API falhar
      console.warn('[Matrícula Popup] RD Station API retornou erro. Lead salvo localmente como backup.');
      saveLocalBackup(data);
    }
  }

  /* ── Backup local (caso a API falhe) ── */
  function saveLocalBackup(data) {
    try {
      const key = 'mp_leads_backup';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push({ ...data, timestamp: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(existing));
    } catch(e) { /* silencioso */ }
  }

  /* ── Montar link WhatsApp ── */
  function buildWALink(nome) {
    const mensagem = POPUP_CONFIG.CURSOS[cursoAtivo] || POPUP_CONFIG.CURSOS['default'];
    const msg = encodeURIComponent(`${mensagem}\n\nMeu nome é ${nome}.`);
    return `https://wa.me/${POPUP_CONFIG.WHATSAPP_NUM}?text=${msg}`;
  }

  /* ── Submit ── */
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!validate()) return;

    const data = {
      nome:     document.getElementById('mp-nome').value.trim(),
      email:    document.getElementById('mp-email').value.trim(),
      whatsapp: document.getElementById('mp-whatsapp').value.trim()
    };

    // Loading
    submitBtn.disabled = true;
    submitBtn.classList.add('mp-loading');

    try {
      await sendToRDStation(data);
    } catch (err) {
      console.warn('[Matrícula Popup] Erro na API:', err);
      saveLocalBackup(data);
    }

    // Montar link WA com nome do lead
    waLink.href = buildWALink(data.nome);

    // Mostrar tela de sucesso
    form.style.display = 'none';
    successEl.classList.add('mp-visible');

    // Redirecionar automaticamente após 2.5s
    setTimeout(() => {
      window.open(waLink.href, '_blank');
    }, 2500);
  });

})();
