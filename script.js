/* =========================================================
   TecniYa - Landing MVP
   Interactividad: modales, validación y envío de formularios
   ========================================================= */

(() => {
  "use strict";

  /* ---------- CONFIGURACIÓN ----------
     Para recibir los datos de verdad, pega aquí la URL de tu backend
     (Formspree, Google Apps Script, Supabase, Firebase, tu API, etc.).
     Si lo dejas vacío, los datos se guardan en el navegador (localStorage)
     solo para que puedas probar el flujo. */
  const CONFIG = {
    ENDPOINT_SOLICITUD: "", // ej: "https://formspree.io/f/xxxxxxx"
    ENDPOINT_REGISTRO: "",  // ej: "https://formspree.io/f/yyyyyyy"
    WHATSAPP: "",           // opcional, ej: "51987654321"
  };

  /* ---------- Helpers ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const modals = {
    solicitud: $("#modal-solicitud"),
    registro: $("#modal-registro"),
    exito: $("#modal-exito"),
  };

  /* ---------- Año del footer ---------- */
  $("#year").textContent = new Date().getFullYear();

  /* ---------- Menú móvil ---------- */
  const burger = $("#burger");
  const nav = $("#nav");

  const toggleNav = (open) => {
    const isOpen = open ?? !nav.classList.contains("open");
    nav.classList.toggle("open", isOpen);
    burger.setAttribute("aria-expanded", String(isOpen));
  };

  burger.addEventListener("click", () => toggleNav());
  $$("a", nav).forEach((a) => a.addEventListener("click", () => toggleNav(false)));

  /* ---------- Abrir / cerrar modales ---------- */
  const openModal = (name, preset = {}) => {
    const dlg = modals[name];
    if (!dlg) return;
    toggleNav(false);

    const form = $("form", dlg);
    if (form) {
      // Preselecciona valores (por ejemplo el servicio elegido)
      Object.entries(preset).forEach(([field, value]) => {
        if (form.elements[field]) form.elements[field].value = value;
      });
    }
    if (!dlg.open) dlg.showModal();
    document.body.style.overflow = "hidden";

    const first = $("input:not([type=radio]):not([type=checkbox]), select", dlg);
    if (first) setTimeout(() => first.focus(), 60);
  };

  const closeModal = (dlg) => {
    if (dlg.open) dlg.close();
  };

  // Botones con data-open="solicitud" | "registro"
  $$("[data-open]").forEach((btn) =>
    btn.addEventListener("click", () => openModal(btn.dataset.open))
  );

  // Tarjetas de servicios: abren la solicitud con el servicio preseleccionado
  $$(".service").forEach((card) =>
    card.addEventListener("click", () =>
      openModal("solicitud", { servicio: card.dataset.service })
    )
  );

  // Botones de cerrar y clic fuera del cuadro
  Object.values(modals).forEach((dlg) => {
    $$("[data-close]", dlg).forEach((b) =>
      b.addEventListener("click", () => closeModal(dlg))
    );
    dlg.addEventListener("click", (e) => {
      const r = dlg.getBoundingClientRect();
      const outside =
        e.clientX < r.left || e.clientX > r.right ||
        e.clientY < r.top || e.clientY > r.bottom;
      if (outside) closeModal(dlg);
    });
    dlg.addEventListener("close", () => {
      if (!Object.values(modals).some((m) => m.open)) {
        document.body.style.overflow = "";
      }
    });
  });

  /* ---------- Validación ---------- */
  const PHONE_RE = /^9\d{8}$/;                 // celular Perú: 9 dígitos
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const getError = (el) => {
    const value = el.value.trim();

    if (el.type === "checkbox") {
      return el.checked ? "" : "Debes aceptar para continuar.";
    }
    if (el.required && !value) return "Este campo es obligatorio.";
    if (el.minLength > 0 && value && value.length < el.minLength) {
      return `Escribe al menos ${el.minLength} caracteres.`;
    }
    if (el.type === "tel" && value) {
      const digits = value.replace(/\D/g, "");
      const local = digits.startsWith("51") && digits.length === 11 ? digits.slice(2) : digits;
      if (!PHONE_RE.test(local)) return "Ingresa un celular válido de 9 dígitos (ej. 987654321).";
    }
    if (el.type === "email" && value && !EMAIL_RE.test(value)) {
      return "Ingresa un correo válido.";
    }
    return "";
  };

  const showError = (el, msg) => {
    const field = el.closest(".field");
    const slot = field
      ? $(".error", field)
      : el.closest("form").querySelector(".error--check");
    if (field) field.classList.toggle("invalid", Boolean(msg));
    if (slot) slot.textContent = msg;
    el.setAttribute("aria-invalid", msg ? "true" : "false");
  };

  const validateForm = (form) => {
    let firstInvalid = null;
    $$("input:not([type=radio]), select, textarea", form).forEach((el) => {
      const msg = getError(el);
      showError(el, msg);
      if (msg && !firstInvalid) firstInvalid = el;
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  };

  // Validación en vivo: al salir del campo y al corregir
  $$("form").forEach((form) => {
    form.addEventListener("focusout", (e) => {
      if (e.target.matches("input, select, textarea") && e.target.type !== "radio") {
        showError(e.target, getError(e.target));
      }
    });
    form.addEventListener("input", (e) => {
      if (e.target.closest(".invalid")) showError(e.target, getError(e.target));
    });
    form.addEventListener("change", (e) => {
      if (e.target.type === "checkbox") showError(e.target, getError(e.target));
    });
  });

  // Solo números en teléfonos
  $$("input[type=tel]").forEach((input) =>
    input.addEventListener("input", () => {
      input.value = input.value.replace(/[^\d+\s]/g, "");
    })
  );

  /* ---------- Envío ---------- */
  const saveLocal = (key, data) => {
    try {
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      list.push(data);
      localStorage.setItem(key, JSON.stringify(list));
    } catch (_) { /* navegación privada o storage bloqueado */ }
  };

  const send = async (endpoint, storageKey, data) => {
    if (!endpoint) {
      // Modo demo: guarda en el navegador y simula la espera de red
      saveLocal(storageKey, data);
      console.info(`[TecniYa demo] Datos guardados en localStorage -> ${storageKey}`, data);
      await new Promise((r) => setTimeout(r, 700));
      return;
    }
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Error de red " + res.status);
  };

  const handleSubmit = (form, { endpoint, storageKey, successMsg, extra }) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!validateForm(form)) return;

      const btn = $("button[type=submit]", form);
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Enviando…";

      const data = {
        ...Object.fromEntries(new FormData(form).entries()),
        creado: new Date().toISOString(),
        ...(extra ? extra() : {}),
      };

      try {
        await send(endpoint, storageKey, data);
        form.reset();
        $$(".invalid", form).forEach((f) => f.classList.remove("invalid"));
        $$(".error", form).forEach((s) => (s.textContent = ""));
        closeModal(form.closest("dialog"));
        $("#exito-msg").textContent = successMsg(data);
        modals.exito.showModal();
        document.body.style.overflow = "hidden";
      } catch (err) {
        console.error(err);
        alert("No pudimos enviar tu información. Revisa tu conexión e inténtalo de nuevo.");
      } finally {
        btn.disabled = false;
        btn.textContent = label;
      }
    });
  };

  handleSubmit($("#form-solicitud"), {
    endpoint: CONFIG.ENDPOINT_SOLICITUD,
    storageKey: "tecniya_solicitudes",
    successMsg: (d) =>
      `Recibimos tu solicitud de ${d.servicio.toLowerCase()}. Te contactaremos pronto al ${d.telefono}.`,
  });

  handleSubmit($("#form-registro"), {
    endpoint: CONFIG.ENDPOINT_REGISTRO,
    storageKey: "tecniya_tecnicos",
    successMsg: (d) =>
      `Gracias, ${d.nombre.split(" ")[0]}. Revisaremos tus datos y te escribiremos al ${d.telefono} o a ${d.email}.`,
  });
})();
