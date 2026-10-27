/* Nastri Corvetto scheduling guardrails — isolated lab module.
 * This module validates a proposed plan; it does not generate or apply official shifts.
 * Missing evidence is a blocker, never an implicit approval.
 */
(function (root) {
  "use strict";
  const OFFICE_WEDNESDAY_POOL = new Set(["Davide Alpegiani", "Marco Caregnato", "Severin"]);
  const REQUIRED = ["people", "assignments", "coverageWindows"];

  const result = (status, blockers, warnings, details = {}) => ({
    status, safeToApply: status === "VALID", blockers, warnings, ...details
  });
  const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
  const minutes = value => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return NaN;
    const [h, m] = value.split(":").map(Number);
    return h < 24 && m < 60 ? h * 60 + m : NaN;
  };
  const timeRange = item => {
    const start = minutes(item.start), end = minutes(item.end);
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
  };

  function validatePlan(plan) {
    const blockers = [], warnings = [];
    if (!plan || typeof plan !== "object") return result("BLOCKED", ["Piano assente o non valido."], []);
    for (const key of REQUIRED) {
      if (!Array.isArray(plan[key])) blockers.push("Dato obbligatorio mancante o non valido: " + key + ".");
    }
    if (blockers.length) return result("BLOCKED", blockers, []);
    const people = new Map();
    for (const person of plan.people) {
      if (!person || !person.id || people.has(person.id)) {
        blockers.push("Profilo persona con ID mancante o duplicato.");
        continue;
      }
      people.set(person.id, person);
    }
    const byPerson = new Map();
    const normalized = [];
    for (const a of plan.assignments) {
      if (!a || !a.personId || !people.has(a.personId)) {
        blockers.push("Assegnazione senza persona valida: " + (a && a.id || "senza ID") + ".");
        continue;
      }
      const range = timeRange(a);
      if (!a.day || !range || !a.department) {
        blockers.push("Assegnazione incompleta (giorno, reparto o orario): " + (a.id || a.personId) + ".");
        continue;
      }
      const p = people.get(a.personId);
      if (a.department === "ufficio" && a.day === "mercoledi" && !OFFICE_WEDNESDAY_POOL.has(p.name)) {
        blockers.push(p.name + " non appartiene al gruppo ammesso per l'ufficio del mercoledì.");
      }
      if (a.requiredSkill) {
        if (!Array.isArray(p.skills)) blockers.push("Competenze non censite per " + p.name + ": " + a.requiredSkill + ".");
        else if (!p.skills.includes(a.requiredSkill)) blockers.push(p.name + " non risulta abilitato a: " + a.requiredSkill + ".");
      }
      if (Array.isArray(p.unavailable)) {
        for (const u of p.unavailable) {
          if (u.day === a.day) {
            const ur = timeRange(u);
            if (!ur) blockers.push("Indisponibilità con orario non valido per " + p.name + ".");
            else if (overlaps(range.start, range.end, ur.start, ur.end)) blockers.push(p.name + " assegnato durante un'indisponibilità (" + (u.reason || "motivo non specificato") + ").");
          }
        }
      } else {
        warnings.push("Indisponibilità non censite per " + p.name + ".");
      }
      const key = a.day + "|" + a.personId;
      const entries = byPerson.get(key) || [];
      for (const old of entries) {
        const oldRange = timeRange(old);
        if (oldRange && overlaps(range.start, range.end, oldRange.start, oldRange.end)) {
          blockers.push(p.name + " ha assegnazioni sovrapposte il " + a.day + ".");
        }
      }
      entries.push(a); byPerson.set(key, entries);
      normalized.push({ assignment: a, person: p, range });
    }

    // Typed events make non-availability explicit. They are not automatically counted as work hours.
    const EVENT_TYPES = new Set(["ferie","rol","permesso-retribuito","permesso-non-retribuito","donazione-sangue","corso","visita-medica","pausa","recupero","altro"]);
    for (const ev of (Array.isArray(plan.events) ? plan.events : [])) {
      if (!ev || !ev.personId || !people.has(ev.personId) || !ev.day || !EVENT_TYPES.has(ev.type) || !timeRange(ev)) {
        blockers.push("Evento personale incompleto: servono persona, giorno, tipo riconosciuto e orari validi.");
        continue;
      }
      if (ev.type === "altro" && !(typeof ev.description === "string" && ev.description.trim())) {
        blockers.push("Evento di tipo altro: specificare una descrizione.");
      }
      const er = timeRange(ev), person = people.get(ev.personId);
      const conflicts = normalized.filter(x => x.person.id === ev.personId && x.assignment.day === ev.day &&
        overlaps(x.range.start, x.range.end, er.start, er.end));
      if (conflicts.length) blockers.push(person.name + " ha un turno assegnato durante l'evento " + ev.type +
        " (" + ev.start + "–" + ev.end + "); dividere il turno o correggere l'evento.");
      if (ev.type === "pausa" && ev.countsAsCoverage === true) {
        blockers.push("Una pausa non può essere conteggiata come copertura.");
      }
      if (ev.countsAsWorkHours === undefined) {
        warnings.push("Conteggio ore non configurato per l'evento " + ev.type + " di " + person.name +
          " (" + ev.day + " " + ev.start + "–" + ev.end + ").");
      }
    }

    // Pair integrity: only enforced where a pair is explicitly declared as required.
    const requiredPairs = Array.isArray(plan.requiredPairs) ? plan.requiredPairs : [];
    for (const pair of requiredPairs) {
      if (!pair || !pair.day || !pair.start || !pair.end || !Array.isArray(pair.personIds) || pair.personIds.length !== 2) {
        blockers.push("Regola coppia magazzino incompleta.");
        continue;
      }
      const pr = timeRange(pair);
      if (!pr) { blockers.push("Orario della coppia non valido."); continue; }
      const active = normalized.filter(x => x.assignment.day === pair.day &&
        x.assignment.department === "magazzino" &&
        overlaps(x.range.start, x.range.end, pr.start, pr.end) &&
        pair.personIds.includes(x.person.id));
      const present = new Set(active.map(x => x.person.id));
      if (present.size !== 2) {
        const overrides = Array.isArray(plan.emergencyCoverageOverrides) ? plan.emergencyCoverageOverrides : [];
        const emergency = overrides.find(o => {
          const or = o && timeRange(o);
          if (!(o && or && o.day===pair.day && o.department==="magazzino" &&
            or.start<=pr.start && or.end>=pr.end && o.allowRequiredPairSplit===true &&
            typeof o.reason==="string" && o.reason.trim() &&
            typeof o.approvedBy==="string" && o.approvedBy.trim() &&
            Number.isInteger(o.minimumOperationalPeople) && o.minimumOperationalPeople>=1)) return false;
          const headcount = normalized.filter(x => x.assignment.day===pair.day &&
            x.assignment.department==="magazzino" && x.range.start<=pr.start && x.range.end>=pr.end).length;
          return headcount >= o.minimumOperationalPeople;
        });
        if (emergency) warnings.push("Deroga emergenziale autorizzata: coppia magazzino separata il "+pair.day+" "+pair.start+"–"+pair.end+". Motivo: "+emergency.reason.trim()+". Autorizzata da: "+emergency.approvedBy.trim()+". Verificare attività consentite e sicurezza.");
        else blockers.push("Coppia richiesta non completa per " + pair.day + " " + pair.start + "–" + pair.end + ". Nessuna deroga valida con minimo operativo rispettato.");
      }
    }

    // Warehouse opening rule: if three or more workers are explicitly available,
    // require the configured minimum at every point of the opening window.
    for (const rule of (Array.isArray(plan.warehouseOpeningRules) ? plan.warehouseOpeningRules : [])) {
      const rr = rule && timeRange(rule);
      if (!rule || !rr || !rule.day || !Array.isArray(rule.availablePersonIds) ||
          !Number.isInteger(rule.minimumWhenThreeOrMore) || rule.minimumWhenThreeOrMore < 1) {
        blockers.push("Regola apertura magazzino incompleta o non valida.");
        continue;
      }
      const available = new Set(rule.availablePersonIds.filter(id => people.has(id)));
      if (available.size !== rule.availablePersonIds.length) {
        blockers.push("Regola apertura magazzino: uno o più ID disponibili non corrispondono a persone censite.");
        continue;
      }
      if (available.size < 3) continue;
      const boundaries = new Set([rr.start, rr.end]);
      normalized.forEach(x => {
        if (x.assignment.day === rule.day && x.assignment.department === "magazzino" &&
            available.has(x.person.id) && overlaps(x.range.start, x.range.end, rr.start, rr.end)) {
          boundaries.add(Math.max(rr.start, x.range.start));
          boundaries.add(Math.min(rr.end, x.range.end));
        }
      });
      const points = [...boundaries].sort((a,b)=>a-b);
      for (let i=0; i<points.length-1; i++) {
        const left=points[i], right=points[i+1];
        if (right<=left) continue;
        const count = normalized.filter(x => x.assignment.day===rule.day &&
          x.assignment.department==="magazzino" && available.has(x.person.id) &&
          x.range.start<=left && x.range.end>=right).length;
        if (count < rule.minimumWhenThreeOrMore) {
          blockers.push("Apertura magazzino sotto soglia: " + rule.day + " " +
            String(Math.floor(left/60)).padStart(2,"0")+":"+String(left%60).padStart(2,"0")+"–"+
            String(Math.floor(right/60)).padStart(2,"0")+":"+String(right%60).padStart(2,"0")+
            " ("+count+"/"+rule.minimumWhenThreeOrMore+" addetti disponibili assegnati).");
          break;
        }
      }
    }

    // Preferred pairs are a soft constraint: splitting one raises a review warning,
    // while explicitly required pairs above remain a hard blocker.
    for (const pair of (Array.isArray(plan.preferredPairs) ? plan.preferredPairs : [])) {
      if (!pair || !pair.day || !pair.start || !pair.end || !Array.isArray(pair.personIds) || pair.personIds.length !== 2) {
        blockers.push("Preferenza coppia magazzino incompleta o non valida.");
        continue;
      }
      const pr = timeRange(pair);
      if (!pr) { blockers.push("Orario della coppia preferenziale non valido."); continue; }
      const active = normalized.filter(x => x.assignment.day === pair.day &&
        x.assignment.department === "magazzino" &&
        overlaps(x.range.start, x.range.end, pr.start, pr.end) &&
        pair.personIds.includes(x.person.id));
      const present = new Set(active.map(x => x.person.id));
      if (present.size === 1) {
        const person = people.get([...present][0]);
        warnings.push("Coppia preferenziale separata: " + (person ? person.name : [...present][0]) +
          " lavora senza il compagno previsto il " + pair.day + " " + pair.start + "–" + pair.end + ". Verificare se Mario jolly può coprire prima di confermare.");
      }
    }

    // Explicit office coverage roles: opening and closing are separate windows, not just total headcount.
    for (const w of (Array.isArray(plan.officeCoverageWindows) ? plan.officeCoverageWindows : [])) {
      const wr = w && timeRange(w);
      if (!w || !wr || !w.day || !["apertura","chiusura"].includes(w.role) ||
          !Number.isInteger(w.minPeople) || w.minPeople < 1) {
        blockers.push("Finestra di copertura ufficio per ruolo incompleta o non valida.");
        continue;
      }
      const covered = normalized.filter(x => x.assignment.day === w.day &&
        x.assignment.department === "ufficio" && x.range.start <= wr.start && x.range.end >= wr.end &&
        (!Array.isArray(x.assignment.roles) || x.assignment.roles.includes(w.role)));
      const eligible = w.day === "mercoledi" ? covered.filter(x => OFFICE_WEDNESDAY_POOL.has(x.person.name)) : covered;
      if (eligible.length < w.minPeople) {
        blockers.push("Copertura ufficio insufficiente (" + w.day + ", " + w.role + "): " +
          w.start + "–" + w.end + " (" + eligible.length + "/" + w.minPeople + ").");
      }
    }

    // Every declared coverage window must be covered for its entire duration.
    for (const w of plan.coverageWindows) {
      const wr = w && timeRange(w);
      if (!w || !wr || !w.day || !w.department || !Number.isInteger(w.minPeople) || w.minPeople < 1) {
        blockers.push("Finestra di copertura incompleta o non valida.");
        continue;
      }
      const boundaries = new Set([wr.start, wr.end]);
      normalized.forEach(x => {
        if (x.assignment.day === w.day && x.assignment.department === w.department && overlaps(x.range.start, x.range.end, wr.start, wr.end)) {
          boundaries.add(Math.max(wr.start, x.range.start));
          boundaries.add(Math.min(wr.end, x.range.end));
        }
      });
      const points = [...boundaries].sort((a,b)=>a-b);
      const overrides = Array.isArray(plan.emergencyCoverageOverrides) ? plan.emergencyCoverageOverrides : [];
      for (let i=0; i<points.length-1; i++) {
        const left=points[i], right=points[i+1];
        if (right<=left) continue;
        const count = normalized.filter(x => x.assignment.day===w.day && x.assignment.department===w.department &&
          x.range.start<=left && x.range.end>=right).length;
        if (count < w.minPeople) {
          const override = overrides.find(o => {
            const or = o && timeRange(o);
            return o && or && o.day===w.day && o.department===w.department &&
              or.start<=left && or.end>=right &&
              typeof o.reason==="string" && o.reason.trim() &&
              typeof o.approvedBy==="string" && o.approvedBy.trim() &&
              Number.isInteger(o.minimumOperationalPeople) && o.minimumOperationalPeople>=1;
          });
          if (override && count >= override.minimumOperationalPeople) {
            warnings.push("Deroga emergenziale autorizzata: copertura " + w.department + " " + w.day + " " +
              String(Math.floor(left/60)).padStart(2,"0")+":"+String(left%60).padStart(2,"0")+"–"+
              String(Math.floor(right/60)).padStart(2,"0")+":"+String(right%60).padStart(2,"0")+
              " ridotta a "+count+"/"+w.minPeople+" persone. Motivo: "+override.reason.trim()+
              ". Autorizzata da: "+override.approvedBy.trim()+". Verificare la sicurezza operativa.");
          } else {
            blockers.push("Copertura insufficiente: " + w.department + " " + w.day + " " +
              String(Math.floor(left/60)).padStart(2,"0")+":"+String(left%60).padStart(2,"0")+"–"+
              String(Math.floor(right/60)).padStart(2,"0")+":"+String(right%60).padStart(2,"0")+
              " ("+count+"/"+w.minPeople+" persone)."+(override ? " Sotto il minimo operativo d'emergenza ("+override.minimumOperationalPeople+")." : ""));
            break;
          }
        }
      }
    }
    // Skill-aware coverage windows: headcount alone is not proof of task coverage.
    for (const w of (Array.isArray(plan.skillCoverageWindows) ? plan.skillCoverageWindows : [])) {
      const wr = w && timeRange(w);
      if (!w || !wr || !w.day || !w.department || !w.requiredSkill ||
          !Number.isInteger(w.minPeople) || w.minPeople < 1) {
        blockers.push("Finestra di copertura per competenza incompleta o non valida.");
        continue;
      }
      const boundaries = new Set([wr.start, wr.end]);
      normalized.forEach(x => {
        if (x.assignment.day === w.day && x.assignment.department === w.department &&
            overlaps(x.range.start, x.range.end, wr.start, wr.end)) {
          boundaries.add(Math.max(wr.start, x.range.start));
          boundaries.add(Math.min(wr.end, x.range.end));
        }
      });
      const points = [...boundaries].sort((a,b)=>a-b);
      for (let i=0; i<points.length-1; i++) {
        const left=points[i], right=points[i+1];
        if (right<=left) continue;
        const qualified = normalized.filter(x =>
          x.assignment.day===w.day && x.assignment.department===w.department &&
          x.range.start<=left && x.range.end>=right &&
          Array.isArray(x.person.skills) && x.person.skills.includes(w.requiredSkill)).length;
        if (qualified < w.minPeople) {
          blockers.push("Competenza non coperta: " + w.requiredSkill + " in " + w.department + " " + w.day + " " +
            String(Math.floor(left/60)).padStart(2,"0")+":"+String(left%60).padStart(2,"0")+"–"+
            String(Math.floor(right/60)).padStart(2,"0")+":"+String(right%60).padStart(2,"0")+
            " ("+qualified+"/"+w.minPeople+" persone abilitate).");
          break;
        }
      }
    }

    const uniqueBlockers = [...new Set(blockers)];
    const uniqueWarnings = [...new Set(warnings)];
    return result(uniqueBlockers.length ? "BLOCKED" : uniqueWarnings.length ? "NEEDS_REVIEW" : "VALID",
      uniqueBlockers, uniqueWarnings, { checkedAssignments: normalized.length });
  }

  // Ranks possible replacements; never edits the plan. Unknown skills/availability fail closed.
  function rankReplacements({ people, day, start, end, department, requiredSkill, excludedIds = [], currentAssignments = [] }) {
    const startMin = minutes(start), endMin = minutes(end);
    if (!Array.isArray(people) || !day || !department || !Number.isFinite(startMin) ||
        !Number.isFinite(endMin) || endMin <= startMin) {
      return { status: "BLOCKED", candidates: [], reason: "Dati dello scenario incompleti." };
    }
    const excluded = new Set(excludedIds);
    const candidates = [];
    for (const p of people) {
      if (!p || !p.id || !p.name || excluded.has(p.id)) continue;
      if (requiredSkill && (!Array.isArray(p.skills) || !p.skills.includes(requiredSkill))) continue;
      if (!Array.isArray(p.unavailable)) continue; // unknown availability: do not recommend
      const blocked = p.unavailable.some(u => {
        if (u.day !== day) return false;
        const r = timeRange(u);
        return !r || overlaps(startMin, endMin, r.start, r.end);
      });
      if (blocked) continue;
      const collision = currentAssignments.some(a => a.personId === p.id && a.day === day && timeRange(a) &&
        overlaps(startMin, endMin, timeRange(a).start, timeRange(a).end));
      if (collision) continue;
      if (department === "ufficio" && day === "mercoledi" && !OFFICE_WEDNESDAY_POOL.has(p.name)) continue;
      candidates.push({ id: p.id, name: p.name, skills: p.skills, reason: "Disponibilità e requisiti noti compatibili; verificare impatto sul resto del piano." });
    }
    // Stable, explainable ordering: prefer ordinary staff before a declared jolly.
    // This is only a tie-breaker; it does not replace whole-plan validation.
    candidates.sort((a,b) => {
      const pa=people.find(p=>p && p.id===a.id), pb=people.find(p=>p && p.id===b.id);
      const ja=!!(pa && (pa.isJolly===true || (Array.isArray(pa.skills)&&pa.skills.includes("jolly"))));
      const jb=!!(pb && (pb.isJolly===true || (Array.isArray(pb.skills)&&pb.skills.includes("jolly"))));
      return Number(ja)-Number(jb) || a.name.localeCompare(b.name);
    });
    for (const c of candidates) {
      const p=people.find(x=>x && x.id===c.id);
      const jolly=!!(p && (p.isJolly===true || (Array.isArray(p.skills)&&p.skills.includes("jolly"))));
      c.reason=jolly
        ? "Candidato verificato ma marcato come jolly: preferire personale ordinario compatibile se disponibile; verificare l'impatto sull'intera giornata."
        : "Disponibilità e requisiti noti compatibili; candidato ordinario prioritario. Verificare l'impatto sull'intero piano.";
    }
    return { status: candidates.length ? "CANDIDATES_FOR_REVIEW" : "NO_VERIFIED_CANDIDATE",
      candidates, reason: candidates.length ? "Candidati ordinati in modo deterministico: personale ordinario prima del jolly; l'ordine non è un'approvazione e va verificato sul piano completo." :
      "Nessun candidato verificato. Non inventare una sostituzione: dichiarare copertura impossibile o chiedere dati." };
  }
  // Compares supplied proposals without generating or applying shifts.
  // Locked/manual assignments must remain byte-for-byte equivalent on operational fields.
  function compareProposals({ baseline, proposals, lockedAssignmentIds = [] } = {}) {
    if (!baseline || !Array.isArray(baseline.assignments) || !Array.isArray(proposals) ||
        !Array.isArray(lockedAssignmentIds)) {
      return { status:"BLOCKED", proposals:[], reason:"Baseline, proposte o vincoli manuali mancanti." };
    }
    const locked = new Set(lockedAssignmentIds);
    const baselineById = new Map(baseline.assignments.filter(a=>a && a.id).map(a=>[a.id,a]));
    const signature = a => JSON.stringify({
      personId:a && a.personId, day:a && a.day, department:a && a.department,
      start:a && a.start, end:a && a.end,
      roles:Array.isArray(a && a.roles) ? [...a.roles].sort() : null,
      requiredSkill:a && a.requiredSkill
    });
    const evaluated = proposals.map((proposal,index)=>{
      const id = proposal && proposal.id || "proposal-"+(index+1);
      const label = proposal && proposal.label || id;
      if (!proposal || !proposal.plan) return {id,label,status:"BLOCKED",safeToApply:false,
        blockers:["Proposta senza piano."],warnings:[],score:null};
      const validation = validatePlan(proposal.plan);
      const blockers = [...validation.blockers];
      for (const assignmentId of locked) {
        const original = baselineById.get(assignmentId);
        if (!original) {
          blockers.push("Vincolo manuale sconosciuto nel piano base: "+assignmentId+".");
          continue;
        }
        const candidate = proposal.plan.assignments.find(a=>a && a.id===assignmentId);
        if (!candidate || signature(candidate)!==signature(original)) {
          blockers.push("Assegnazione manuale protetta modificata o rimossa: "+assignmentId+".");
        }
      }
      const unique = [...new Set(blockers)];
      const status = unique.length ? "BLOCKED" : validation.status;
      return {id,label,status,safeToApply:status==="VALID",blockers:unique,
        warnings:validation.warnings,checkedAssignments:validation.checkedAssignments,
        score:status==="VALID"?0:status==="NEEDS_REVIEW"?1:2};
    });
    evaluated.sort((a,b)=>a.score-b.score ||
      a.warnings.length-b.warnings.length || a.blockers.length-b.blockers.length ||
      String(a.label).localeCompare(String(b.label)));
    return {status:evaluated.some(p=>p.status==="VALID")?"HAS_VALID_PROPOSAL":
      evaluated.some(p=>p.status==="NEEDS_REVIEW")?"REVIEW_REQUIRED":"NO_VALID_PROPOSAL",
      proposals:evaluated,reason:"Confronto deterministico: non genera turni e non applica modifiche."};
  }

  // Bounded deterministic generator for explicitly described open slots.
  // It only returns reviewed candidate plans; it never writes or applies a schedule.
  function generateProposals({ baseline, slots, lockedAssignmentIds = [], maxProposals = 12 } = {}) {
    if (!baseline || !Array.isArray(baseline.people) || !Array.isArray(baseline.assignments) ||
        !Array.isArray(slots) || !slots.length || !Array.isArray(lockedAssignmentIds) ||
        !Number.isInteger(maxProposals) || maxProposals < 1 || maxProposals > 50) {
      return { status:"BLOCKED", proposals:[], reason:"Servono piano base, slot espliciti e limite proposte valido." };
    }
    const locked = new Set(lockedAssignmentIds);
    const baseById = new Map(baseline.assignments.filter(a=>a && a.id).map(a=>[a.id,a]));
    const prepared = [];
    const errors = [];
    const slotIds = new Set();
    const assignmentIds = new Set();
    for (const a of baseline.assignments) {
      if (!a || !a.id || assignmentIds.has(a.id)) {
        errors.push("Il piano base contiene ID di assegnazione mancanti o duplicati.");
        break;
      }
      assignmentIds.add(a.id);
    }
    for (const slot of slots) {
      if (slot && slot.id) {
        if (slotIds.has(slot.id)) {
          errors.push("ID slot duplicato: " + slot.id + ".");
          continue;
        }
        slotIds.add(slot.id);
        if (assignmentIds.has("generated-" + slot.id)) {
          errors.push("ID assegnazione generata già presente nel piano base: generated-" + slot.id + ".");
          continue;
        }
      }
      if (!slot || !slot.id || !slot.day || !slot.department || !timeRange(slot) ||
          (slot.eligiblePersonIds !== undefined && !Array.isArray(slot.eligiblePersonIds))) {
        errors.push("Slot incompleto: servono ID, giorno, reparto e orari validi.");
        continue;
      }
      if (slot.replaceAssignmentId && locked.has(slot.replaceAssignmentId)) {
        errors.push("Lo slot "+slot.id+" tenta di sostituire un'assegnazione manuale protetta.");
        continue;
      }
      if (slot.replaceAssignmentId && !baseById.has(slot.replaceAssignmentId)) {
        errors.push("Assegnazione da sostituire non trovata per lo slot "+slot.id+".");
        continue;
      }
      const removeId = slot.replaceAssignmentId;
      const current = baseline.assignments.filter(a=>!removeId || a.id!==removeId);
      const pool = baseline.people.filter(p=>!slot.eligiblePersonIds || slot.eligiblePersonIds.includes(p.id));
      const ranked = rankReplacements({people:pool,day:slot.day,start:slot.start,end:slot.end,
        department:slot.department,requiredSkill:slot.requiredSkill,
        currentAssignments:current});
      if (!ranked.candidates.length) {
        errors.push("Nessun candidato verificato per lo slot "+slot.id+".");
        continue;
      }
      prepared.push({slot,current,candidates:ranked.candidates});
    }
    if (errors.length || prepared.length !== slots.length) {
      return {status:"NO_COMPLETE_GENERATION",proposals:[],errors,
        reason:"Generazione interrotta: dati o candidati insufficienti; nessun turno creato."};
    }
    let combinations = [[]];
    for (const item of prepared) {
      const next = [];
      for (const partial of combinations) for (const person of item.candidates) {
        if (partial.some(x=>x.personId===person.id && x.day===item.slot.day &&
            overlaps(minutes(x.start),minutes(x.end),minutes(item.slot.start),minutes(item.slot.end)))) continue;
        next.push([...partial,{slotId:item.slot.id,personId:person.id,day:item.slot.day,
          department:item.slot.department,start:item.slot.start,end:item.slot.end}]);
        if (next.length >= Math.min(500, maxProposals*20)) break;
      }
      if (next.length > Math.min(500, maxProposals*20)) next.length = Math.min(500, maxProposals*20);
      combinations = next;
      if (!combinations.length) break;
    }
    const proposals = [];
    let n=0;
    for (const combination of combinations) {
      const assignments = baseline.assignments.filter(a=>
        !prepared.some(x=>x.slot.replaceAssignmentId && x.slot.replaceAssignmentId===a.id)).map(a=>({...a}));
      for (const item of combination) {
        const slot=prepared.find(x=>x.slot.id===item.slotId).slot;
        assignments.push({id:"generated-"+item.slotId,personId:item.personId,day:item.day,
          department:item.department,start:item.start,end:item.end,
          ...(Array.isArray(slot.roles)?{roles:[...slot.roles]}:{}),
          ...(slot.requiredSkill?{requiredSkill:slot.requiredSkill}:{}),
          ...(typeof slot.countsAsWorkHours==="boolean"?{countsAsWorkHours:slot.countsAsWorkHours}:{})});
      }
      const plan={...baseline,assignments};
      const sig=JSON.stringify(assignments.map(a=>[a.id,a.personId,a.day,a.start,a.end]).sort());
      if (proposals.some(p=>p._signature===sig)) continue;
      n++;
      proposals.push({id:"generated-proposal-"+n,label:"Alternativa "+n,plan,_signature:sig});
      if (proposals.length>=maxProposals) break;
    }
    if (!proposals.length) return {status:"NO_VALID_COMBINATION",proposals:[],
      reason:"Nessuna combinazione compatibile tra i candidati espliciti. Copertura impossibile o dati da verificare."};
    const compared=compareProposals({baseline,proposals,lockedAssignmentIds});
    const byId=new Map(proposals.map(q=>[q.id,q]));
    const personById=new Map(baseline.people.map(p=>[p.id,p]));
    const original=new Map(baseline.assignments.filter(a=>a&&a.id).map(a=>[a.id,a]));
    const quality = p => {
      const q=byId.get(p.id), plan=q&&q.plan;
      if (!plan) return {status:3,warnings:99,pairPenalty:99,jollyPenalty:99,changed:99};
      const status={VALID:0,NEEDS_REVIEW:1,BLOCKED:2}[p.status] ?? 3;
      const pairPenalty=(p.warnings||[]).filter(w=>w.includes("Coppia preferenziale separata")).length;
      const jollyPenalty=plan.assignments.filter(a=>{
        const person=personById.get(a.personId);
        return person && (person.isJolly===true || (Array.isArray(person.skills)&&person.skills.includes("jolly"))) &&
          !original.has(a.id);
      }).length;
      let changed=0;
      for (const id of locked) { if (!original.has(id)) changed+=100; }
      for (const [id,a] of original) {
        const b=plan.assignments.find(x=>x&&x.id===id);
        if (!b || JSON.stringify([a.personId,a.day,a.department,a.start,a.end])!==JSON.stringify([b.personId,b.day,b.department,b.start,b.end])) changed++;
      }
      return {status,warnings:(p.warnings||[]).length,pairPenalty,jollyPenalty,changed};
    };
    const cleaned=compared.proposals.map(p=>({...p,plan:byId.get(p.id).plan,
      quality:quality(p),decisionReasons:[
        p.status==="VALID"?"Vincoli controllati senza blocchi né avvisi.":p.status==="NEEDS_REVIEW"?"Richiede revisione degli avvisi.":"Proposta bloccata da vincoli non rispettati.",
        (p.warnings||[]).some(w=>w.includes("Coppia preferenziale separata"))?"Una coppia preferenziale risulta separata.":null,
        quality(p).jollyPenalty?"Impiega una persona marcata esplicitamente come jolly.":null
      ].filter(Boolean)}));
    cleaned.sort((a,b)=>a.quality.status-b.quality.status ||
      a.quality.warnings-b.quality.warnings ||
      a.quality.pairPenalty-b.quality.pairPenalty ||
      a.quality.jollyPenalty-b.quality.jollyPenalty ||
      a.quality.changed-b.quality.changed || a.label.localeCompare(b.label));
    return {status:cleaned.some(p=>p.status==="VALID")?"HAS_VALID_PROPOSAL":
      cleaned.some(p=>p.status==="NEEDS_REVIEW")?"REVIEW_REQUIRED":"NO_VALID_PROPOSAL",
      proposals:cleaned,exploredCombinations:combinations.length,
      reason:"Ricerca limitata e deterministica: priorità a validità, avvisi, coppie preferenziali, uso del jolly esplicitamente censito e stabilità delle assegnazioni. Non garantisce l'ottimo globale e non applica turni."};
  }

  // Conservative hour ledger: only explicit countsAsWorkHours flags are counted.
  // Missing payroll semantics stay unknown; overlaps invalidate totals to avoid double counting.
  function summarizeHours(plan, weeklyLimitMinutes = 2400) {
    if (!plan || !Array.isArray(plan.people) || !Array.isArray(plan.assignments) ||
        !Array.isArray(plan.events) || !Number.isFinite(weeklyLimitMinutes) || weeklyLimitMinutes < 0) {
      return { status: "BLOCKED", people: [], errors: ["Dati insufficienti per il riepilogo ore."] };
    }
    const people = new Map(plan.people.filter(p => p && p.id).map(p => [p.id, p]));
    const records = [];
    const errors = [];
    for (const a of plan.assignments) {
      const r = a && timeRange(a);
      if (!a || !people.has(a.personId) || !a.day || !r) {
        errors.push("Segmento turno non valido nel riepilogo ore.");
        continue;
      }
      records.push({ personId:a.personId, day:a.day, start:r.start, end:r.end,
        kind:"turno", flag:a.countsAsWorkHours });
    }
    for (const ev of plan.events) {
      const r = ev && timeRange(ev);
      if (!ev || !people.has(ev.personId) || !ev.day || !r) {
        errors.push("Evento non valido nel riepilogo ore.");
        continue;
      }
      records.push({ personId:ev.personId, day:ev.day, start:r.start, end:r.end,
        kind:"evento:" + (ev.type || "sconosciuto"), flag:ev.countsAsWorkHours });
    }
    const peopleRows = [];
    for (const [id, person] of people) {
      const mine = records.filter(r => r.personId === id);
      const unknown = mine.filter(r => typeof r.flag !== "boolean");
      const counted = mine.filter(r => r.flag === true);
      const overlapsFound = [];
      for (let i=0; i<mine.length; i++) for (let j=i+1; j<mine.length; j++) {
        if (mine[i].day === mine[j].day && overlaps(mine[i].start,mine[i].end,mine[j].start,mine[j].end)) {
          overlapsFound.push(mine[i].day + " " + mine[i].kind + " / " + mine[j].kind);
        }
      }
      const knownMinutes = counted.reduce((sum,r)=>sum+(r.end-r.start),0);
      const safeTotal = overlapsFound.length ? null : knownMinutes;
      peopleRows.push({ personId:id, name:person.name || id,
        knownWorkMinutes:safeTotal, knownWorkHours:safeTotal === null ? null : Math.round(safeTotal/60*100)/100,
        unknownRecordCount:unknown.length, unknownRecords:unknown.map(r=>({day:r.day,kind:r.kind,start:r.start,end:r.end})),
        overlaps:overlapsFound,
        overWeeklyLimit:safeTotal === null ? null : safeTotal > weeklyLimitMinutes,
        status:overlapsFound.length ? "BLOCKED_OVERLAP" : unknown.length ? "INCOMPLETE" :
          safeTotal > weeklyLimitMinutes ? "NEEDS_HR_REVIEW" : "COMPLETE"
      });
    }
    if (errors.length) return { status:"BLOCKED", people:peopleRows, errors };
    return { status: peopleRows.some(p=>p.status==="BLOCKED_OVERLAP") ? "BLOCKED" :
      peopleRows.some(p=>p.status==="INCOMPLETE" || p.status==="NEEDS_HR_REVIEW") ? "NEEDS_REVIEW" : "COMPLETE",
      weeklyLimitMinutes, people:peopleRows, errors:[] };
  }
  root.CorvettoEngine = Object.freeze({ validatePlan, rankReplacements, compareProposals, generateProposals, summarizeHours, minutes });
})(typeof window !== "undefined" ? window : globalThis);
