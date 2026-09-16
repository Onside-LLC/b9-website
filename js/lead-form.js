/* Onside shared lead endpoint - B9 client integration.
 *
 * This is the first client use of Onside's multi-tenant contact endpoint
 * (b9-website#3, onside-rails#109). There is no Formspree, no mailto and no
 * per-site handler: every lesson inquiry is persisted in Onside's database,
 * routed to B9, and reportable.
 *
 * Contract (from onside-rails#109, quoted in b9-website#3):
 *
 *   1. GET  https://onside.llc/contact/form_token
 *      Sent with the page's Origin. Returns
 *        { "form_token": "...", "turnstile_site_key": null | "0x..." }
 *      403 if the Origin is not on the allowlist (Client#form_origin).
 *
 *   2. POST https://onside.llc/contact   (JSON)
 *      { "form_token": "...",
 *        "cf-turnstile-response": "...",        // only when a site key came back
 *        "contact_submission": {
 *          "name": "", "email": "", "message": "",
 *          "phone": "", "company": "", "division": ""
 *        } }
 *      Must be sent at least 3 seconds after the token was minted and within
 *      one day of it. An empty hidden `website` field is the honeypot. No
 *      cookies: the request is sent without credentials.
 *
 *   3. Responses
 *      201 { "status": "ok",    "message": "..." }
 *      422 { "status": "error", "errors": [ ... ] }
 *      403 bad origin
 *
 * STATE ON ARRIVAL: the endpoint is not deployed yet (onside-rails#109 is a
 * draft), so the token fetch fails and every form on the site renders itself
 * inert with the phone number shown instead. That is the intended behaviour
 * until #109 merges and deploys and Client id=8 has
 * form_origin = https://b9baseball.com. Do not cut over (b9-website#2) before
 * then: the old site has no form and the new one must not launch with a dead
 * one.
 *
 * Field mapping. The endpoint has no typed youth-sports fields yet, so the
 * lesson-inquiry questions fold into the generic ones (agreed in b9-website#3):
 *
 *   name     <- parent name        company  <- player name
 *   email    <- parent email       division <- baseball | softball
 *   phone    <- phone              message  <- player age/grad year + what
 *                                              they want help with
 */

(function () {
  "use strict";

  var ENDPOINT = "https://onside.llc";
  var TOKEN_URL = ENDPOINT + "/contact/form_token";
  var SUBMIT_URL = ENDPOINT + "/contact";

  // The endpoint rejects a submission posted less than 3 seconds after the
  // token was minted, and one posted more than a day after. Mint on load so a
  // dead endpoint is visible immediately, and re-mint before submitting if the
  // visitor left the tab open long enough for the token to go stale.
  var MIN_TOKEN_AGE_MS = 3000;
  var MAX_TOKEN_AGE_MS = 6 * 60 * 60 * 1000;

  var PHONE_FALLBACK =
    "Our request form is not reachable right now. Please call (832) 384-5503 or " +
    "email bottomoftheninthbaseball@gmail.com and we will get your player scheduled.";

  function init(form) {
    var state = { token: null, mintedAt: 0, turnstileKey: null, sending: false, dead: false };
    var status = form.querySelector(".form-status");
    var thanks = document.getElementById(form.dataset.thanks);
    var submit = form.querySelector(".submit-btn");

    mint(state, form, status, submit);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      // `dead` also blocks the Enter-key submit that survives losing the button.
      if (state.sending || state.dead) return;

      // Honeypot. A bot that fills it gets the same thank-you a human gets.
      if (form.elements.website && form.elements.website.value !== "") {
        showThanks(form, thanks);
        return;
      }

      state.sending = true;
      setBusy(submit, true);
      setStatus(status, "is-working", "Sending your request...");

      freshToken(state)
        .then(function () {
          return waitForTokenAge(state);
        })
        .then(function () {
          return send(state, form);
        })
        .then(function (result) {
          if (result.ok) {
            showThanks(form, thanks);
            return;
          }
          state.sending = false;
          setBusy(submit, false);
          setStatus(status, "is-error", result.message, result.errors);
        })
        .catch(function () {
          state.sending = false;
          setBusy(submit, false);
          setStatus(status, "is-error", PHONE_FALLBACK);
        });
    });
  }

  // --- token ---------------------------------------------------------------

  function mint(state, form, status, submit) {
    fetchToken()
      .then(function (data) {
        state.token = data.form_token;
        state.mintedAt = Date.now();
        state.turnstileKey = data.turnstile_site_key || null;
        if (state.turnstileKey) mountTurnstile(form, state.turnstileKey);
      })
      .catch(function () {
        // The endpoint is unreachable or this origin is not allowlisted. Say so
        // rather than collecting an inquiry that will never arrive.
        state.dead = true;
        disable(form, submit);
        setStatus(status, "is-error", PHONE_FALLBACK);
      });
  }

  function fetchToken() {
    return fetch(TOKEN_URL, {
      method: "GET",
      credentials: "omit",
      headers: { Accept: "application/json" }
    }).then(function (response) {
      if (!response.ok) throw new Error("form_token " + response.status);
      return response.json();
    });
  }

  function freshToken(state) {
    if (state.token && Date.now() - state.mintedAt < MAX_TOKEN_AGE_MS) {
      return Promise.resolve();
    }
    return fetchToken().then(function (data) {
      state.token = data.form_token;
      state.mintedAt = Date.now();
    });
  }

  function waitForTokenAge(state) {
    var remaining = MIN_TOKEN_AGE_MS - (Date.now() - state.mintedAt);
    if (remaining <= 0) return Promise.resolve();
    return new Promise(function (resolve) {
      setTimeout(resolve, remaining);
    });
  }

  // --- submit --------------------------------------------------------------

  function send(state, form) {
    var body = {
      form_token: state.token,
      contact_submission: submissionFrom(form)
    };

    if (state.turnstileKey) {
      var answer = form.elements["cf-turnstile-response"];
      body["cf-turnstile-response"] = answer ? answer.value : "";
    }

    return fetch(SUBMIT_URL, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    }).then(function (response) {
      if (response.status === 201) return { ok: true };
      return response
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          return {
            ok: false,
            message: response.status === 403 ? PHONE_FALLBACK : "Please check the form and try again.",
            errors: data.errors || []
          };
        });
    });
  }

  function submissionFrom(form) {
    var f = form.elements;
    return {
      name: value(f.parent_name),
      email: value(f.email),
      phone: value(f.phone),
      company: value(f.player_name),
      division: value(f.sport),
      message: message(f)
    };
  }

  function message(f) {
    return [
      "Player: " + (value(f.player_name) || "not given"),
      "Age or grad year: " + (value(f.player_age) || "not given"),
      "Sport: " + (value(f.sport) || "not given"),
      "Wants help with: " + (value(f.training_need) || "not given")
    ].join("\n");
  }

  function value(field) {
    return field && field.value ? field.value.trim() : "";
  }

  // --- view ----------------------------------------------------------------

  function setStatus(node, kind, text, errors) {
    if (!node) return;
    node.className = "form-status " + kind;
    node.textContent = text;
    if (errors && errors.length) {
      var list = document.createElement("ul");
      list.className = "form-errors";
      errors.forEach(function (error) {
        var item = document.createElement("li");
        item.textContent = error;
        list.appendChild(item);
      });
      node.appendChild(list);
    }
  }

  function setBusy(submit, busy) {
    if (!submit) return;
    submit.disabled = busy;
  }

  // When the endpoint is unreachable the submit button is swapped for a tel:
  // link rather than just greyed out. A disabled button that prints a phone
  // number is not tappable, and a parent on a phone should be one tap from a
  // call instead of copying digits out of an error message.
  function disable(form, submit) {
    if (!submit) return;
    var call = document.createElement("a");
    call.className = "btn btn-primary btn-call";
    call.href = "tel:+18323845503";
    call.textContent = "Call (832) 384-5503";
    submit.parentNode.replaceChild(call, submit);
  }

  function showThanks(form, thanks) {
    if (!thanks) return;
    form.hidden = true;
    thanks.hidden = false;
    thanks.setAttribute("tabindex", "-1");
    thanks.focus();
  }

  // Turnstile is named in the contract but is not switched on yet: the endpoint
  // returns turnstile_site_key: null today. This branch is therefore untested
  // and stays deliberately minimal (implicit render, one script tag). Verify it
  // end to end the first time Cloudflare keys are provisioned.
  function mountTurnstile(form, siteKey) {
    var holder = document.createElement("div");
    holder.className = "cf-turnstile";
    holder.setAttribute("data-sitekey", siteKey);
    form.insertBefore(holder, form.querySelector(".submit-btn"));

    var script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  document.querySelectorAll("form.onside-lead-form").forEach(init);
})();
