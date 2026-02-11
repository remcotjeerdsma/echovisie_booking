/**
 * EchoVisie Booking Widget – Interactive logic & pricing engine
 * Step-based wizard with per-appointment configuration
 */
(function () {
    'use strict';

    /* =========================================================
       CONSTANTS
       ========================================================= */
    var MONTHS_NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
                     'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
    var DAY_MS  = 86400000;
    var WEEK_MS = 7 * DAY_MS;
    var PREGNANCY_WEEKS = 40;
    var PREGNANCY_DAYS  = PREGNANCY_WEEKS * 7;
    var DAYTIME_DISCOUNT = 10;

    var MILESTONES = [
        { id: 'gender',   name: 'Geslachtsbepaling', weekStart: 15, weekEnd: 16, weekIdeal: 16,
          icon: '\uD83D\uDC76', desc: 'Ideaal voor geslachtsbepaling' },
        { id: 'pretecho', name: 'Pretecho (3D/4D)',   weekStart: 24, weekEnd: 30, weekIdeal: 28,
          icon: '\uD83E\uDD30', desc: 'Optimaal voor 3D/4D-beelden' },
        { id: 'growth',   name: 'Groei-echo',         weekStart: 30, weekEnd: 36, weekIdeal: 34,
          icon: '\uD83D\uDCCF', desc: 'Groei en ontwikkeling bekijken' }
    ];

    var STEP_LABELS = ['Samenstellen', 'Afspraken', 'Planning', 'Tijdslot'];
    var DAYTIME_CUTOFF = '17:00'; // Slots before this time qualify for €10 discount

    /* =========================================================
       STATE
       ========================================================= */
    var state = {
        currentStep: 0,
        packageQty: 1,
        pregType: null,          // 'due' | 'lmp' | null
        pregDate: '',            // YYYY-MM-DD

        // Per-appointment configuration
        appointments: [
            makeDefaultAppointment()
        ],

        // Timeslot selection (fetched from Bookly)
        availableSlots: {},    // { aptIdx: [ { date, time, staff_id, staff_name }, ... ] }
        alternativeDates: {},  // { aptIdx: [ { date, date_label, slot_count }, ... ] }
        selectedSlots: {},     // { aptIdx: { date, time, staff_id, staff_name } }
        slotsLoading: false,
        slotsError: null,
        bookingInProgress: false,

        // Customer details
        customerName: '',
        customerEmail: '',
        customerPhone: ''
    };

    function makeDefaultAppointment() {
        return {
            duration: 10,
            addons: {},
            date: '',
            customized: false    // false = inherits from appointment 0
        };
    }

    function getEffectiveConfig(idx) {
        if (idx === 0 || state.appointments[idx].customized) {
            return state.appointments[idx];
        }
        // Inherit from appointment 0, but keep own date
        var base = state.appointments[0];
        return {
            duration: base.duration,
            addons: base.addons,
            date: state.appointments[idx].date,
            customized: false
        };
    }

    function syncAppointmentCount() {
        var qty = state.packageQty;
        while (state.appointments.length < qty) {
            state.appointments.push(makeDefaultAppointment());
        }
        if (state.appointments.length > qty) {
            state.appointments.length = qty;
        }
    }

    /* =========================================================
       PRICING RULES
       ========================================================= */
    function isDaytimeSlot(timeStr) {
        if (!timeStr) return false;
        return timeStr < DAYTIME_CUTOFF;
    }

    function getTimeSlotForApt(aptIdx) {
        var slot = state.selectedSlots[aptIdx];
        if (slot && slot.time) {
            return isDaytimeSlot(slot.time) ? 'working' : 'evening';
        }
        return 'unknown'; // no slot selected yet
    }

    function standardPrice(duration) {
        return 20 + Math.max(0, (duration - 10) / 10) * 15;
    }

    function sessionPrice(duration, timeSlot) {
        var base = standardPrice(duration);
        return timeSlot === 'working' ? base - DAYTIME_DISCOUNT : base;
    }

    function freeSmallPhotos(duration) {
        if (duration < 20) return 0;
        return 2 + Math.max(0, (duration - 20) / 10) * 2;
    }

    function freeLargePhotos(duration) {
        return duration >= 20 ? 1 : 0;
    }

    function genderAvailable(duration) {
        return duration >= 20;
    }

    function recordingFree(duration) {
        return duration >= 40;
    }

    function usbFree(duration) {
        return duration >= 40;
    }

    function included2D(duration) {
        return (duration / 10) * 5;
    }

    function included3D(duration) {
        if (duration < 20) return 0;
        return Math.floor(duration / 10) * 2;
    }

    function included4D(duration) {
        if (duration < 30) return 0;
        return Math.floor(duration / 10) * 1;
    }

    function packageDiscount(qty) {
        if (qty === 2) return 0.10;
        if (qty === 3) return 0.20;
        return 0;
    }

    /* =========================================================
       DATE HELPERS
       ========================================================= */
    function parseDate(str) {
        if (!str) return null;
        var p = str.split('-');
        if (p.length !== 3) return null;
        var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
        return isNaN(d.getTime()) ? null : d;
    }

    function formatDateNL(date) {
        if (!date) return '';
        return date.getDate() + ' ' + MONTHS_NL[date.getMonth()] + ' ' + date.getFullYear();
    }

    function formatDateISO(date) {
        if (!date) return '';
        var y = date.getFullYear();
        var m = ('0' + (date.getMonth() + 1)).slice(-2);
        var d = ('0' + date.getDate()).slice(-2);
        return y + '-' + m + '-' + d;
    }

    function today() {
        var d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /* =========================================================
       PREGNANCY DATE VALIDATION
       ========================================================= */
    function validatePregDate() {
        if (!state.pregType || !state.pregDate) return null;
        var d = parseDate(state.pregDate);
        if (!d) return null;
        var now = today();
        if (state.pregType === 'due') {
            if (d <= now) {
                return 'Je uitgerekende datum moet in de toekomst liggen.';
            }
        } else if (state.pregType === 'lmp') {
            var nineMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 9, now.getDate());
            if (d < nineMonthsAgo) {
                return 'De eerste dag van je laatste menstruatie mag niet langer dan 9 maanden geleden zijn.';
            }
            if (d > now) {
                return 'De eerste dag van je laatste menstruatie kan niet in de toekomst liggen.';
            }
        }
        return null;
    }

    /* =========================================================
       PREGNANCY CALCULATOR
       ========================================================= */
    function getLmpDate() {
        if (!state.pregType || !state.pregDate) return null;
        if (validatePregDate()) return null;
        if (state.pregType === 'lmp') return parseDate(state.pregDate);
        var due = parseDate(state.pregDate);
        if (!due) return null;
        return new Date(due.getTime() - PREGNANCY_DAYS * DAY_MS);
    }

    function getCurrentWeek() {
        var lmp = getLmpDate();
        if (!lmp) return null;
        var diff = today().getTime() - lmp.getTime();
        return Math.floor(diff / WEEK_MS);
    }

    function getDueDate() {
        var lmp = getLmpDate();
        if (!lmp) return null;
        return new Date(lmp.getTime() + PREGNANCY_DAYS * DAY_MS);
    }

    function getDateForWeek(weekNum) {
        var lmp = getLmpDate();
        if (!lmp) return null;
        return new Date(lmp.getTime() + weekNum * WEEK_MS);
    }

    function getMilestoneStatus(milestone, currentWeek) {
        if (currentWeek > milestone.weekEnd) return 'past';
        if (currentWeek >= milestone.weekStart) return 'current';
        return 'future';
    }

    function suggestAppointmentDates(packageQty) {
        var currentWeek = getCurrentWeek();
        if (currentWeek === null) return [];

        var available = [];
        for (var i = 0; i < MILESTONES.length; i++) {
            if (currentWeek <= MILESTONES[i].weekEnd) {
                available.push(MILESTONES[i]);
            }
        }

        var suggestions = [];
        for (var j = 0; j < packageQty && j < available.length; j++) {
            var ms = available[j];
            var idealWeek = Math.max(ms.weekIdeal, currentWeek + 1);
            idealWeek = Math.min(idealWeek, ms.weekEnd);

            suggestions.push({
                milestone: ms,
                idealDate: getDateForWeek(idealWeek),
                rangeStart: getDateForWeek(Math.max(ms.weekStart, currentWeek + 1)),
                rangeEnd: getDateForWeek(ms.weekEnd)
            });
        }
        return suggestions;
    }

    /* =========================================================
       INCLUDED FEATURES – ordered by unlock duration
       ========================================================= */
    function qty(n) {
        return '<span class="ev-inc-qty">' + n + '</span>';
    }

    function buildIncludedCards(duration) {
        return [
            {
                icon: '\uD83D\uDCF7',
                name: 'Digitale 2D-beelden',
                detail: qty(included2D(duration)) + ' beelden inbegrepen',
                free: true,
                unlockAt: 10
            },
            {
                icon: '\uD83D\uDDBC\uFE0F',
                name: 'Kleine foto\'s (print)',
                detail: freeSmallPhotos(duration) > 0
                    ? qty(freeSmallPhotos(duration)) + ' stuks inbegrepen'
                    : 'Beschikbaar als extra (\u20AC2/stuk)',
                free: freeSmallPhotos(duration) > 0,
                unlockAt: 20
            },
            {
                icon: '\uD83D\uDDBC\uFE0F',
                name: 'Grote foto (print)',
                detail: freeLargePhotos(duration) > 0
                    ? qty(1) + ' stuk inbegrepen'
                    : 'Beschikbaar als extra (\u20AC4/stuk)',
                free: freeLargePhotos(duration) > 0,
                unlockAt: 20
            },
            {
                icon: '\uD83D\uDC76',
                name: 'Geslachtsbepaling',
                detail: genderAvailable(duration) ? 'Gratis beschikbaar' : 'Ontgrendeld bij 20 min',
                free: genderAvailable(duration),
                unlockAt: 20
            },
            {
                icon: '\uD83E\uDD30',
                name: 'Digitale 3D-beelden',
                detail: included3D(duration) > 0
                    ? qty(included3D(duration)) + ' beelden inbegrepen'
                    : 'Ontgrendeld bij 20 min',
                free: included3D(duration) > 0,
                unlockAt: 20
            },
            {
                icon: '\uD83C\uDFAC',
                name: '4D-video\'s',
                detail: included4D(duration) > 0
                    ? qty(included4D(duration)) + ' video(s) inbegrepen'
                    : 'Ontgrendeld bij 30 min',
                free: included4D(duration) > 0,
                unlockAt: 30
            },
            {
                icon: '\uD83C\uDFA5',
                name: 'Volledige opname',
                detail: recordingFree(duration) ? 'Gratis inbegrepen' : 'Beschikbaar als extra (\u20AC30)',
                free: recordingFree(duration),
                unlockAt: 40
            },
            {
                icon: '\uD83D\uDD0C',
                name: 'USB-stick (16 GB)',
                detail: usbFree(duration) ? 'Gratis inbegrepen' : 'Beschikbaar als extra (\u20AC10)',
                free: usbFree(duration),
                unlockAt: 40
            }
        ];
    }

    /* =========================================================
       ADD-ON DEFINITIONS
       ========================================================= */
    function buildAddons(duration) {
        var freeSmall = freeSmallPhotos(duration);
        var freeLarge = freeLargePhotos(duration);

        return [
            {
                id: 'extra_small_photo',
                name: 'Extra kleine foto (print)',
                desc: freeSmall > 0
                    ? freeSmall + ' gratis inbegrepen \u2014 extra voor \u20AC2/stuk'
                    : '\u20AC2 per stuk',
                unitPrice: 2,
                type: 'qty',
                minQty: 0,
                maxQty: 20,
                enabled: true
            },
            {
                id: 'extra_large_photo',
                name: 'Extra grote foto (print)',
                desc: freeLarge > 0
                    ? freeLarge + ' gratis inbegrepen \u2014 extra voor \u20AC4/stuk'
                    : '\u20AC4 per stuk',
                unitPrice: 4,
                type: 'qty',
                minQty: 0,
                maxQty: 10,
                enabled: true
            },
            {
                id: 'gender',
                name: 'Geslachtsbepaling',
                desc: genderAvailable(duration) ? 'Gratis bij jouw duur' : 'Beschikbaar vanaf 20 min',
                unitPrice: 0,
                type: 'toggle',
                enabled: genderAvailable(duration)
            },
            {
                id: 'recording',
                name: 'Volledige opname',
                desc: recordingFree(duration) ? 'Gratis inbegrepen' : '\u20AC30',
                unitPrice: recordingFree(duration) ? 0 : 30,
                type: 'toggle',
                enabled: true,
                autoSelected: recordingFree(duration)
            },
            {
                id: 'usb',
                name: 'USB-stick (16 GB)',
                desc: usbFree(duration) ? 'Gratis inbegrepen' : '\u20AC10',
                unitPrice: usbFree(duration) ? 0 : 10,
                type: 'toggle',
                enabled: true,
                autoSelected: usbFree(duration)
            }
        ];
    }

    /* =========================================================
       RENDER HELPERS
       ========================================================= */
    function euro(amount) {
        return '\u20AC' + amount.toFixed(2).replace('.', ',');
    }

    /* =========================================================
       STEP BAR
       ========================================================= */
    function renderStepBar() {
        var container = document.getElementById('ev-step-bar');
        if (!container) return;

        var html = '';
        for (var i = 0; i < STEP_LABELS.length; i++) {
            var cls = 'ev-step-dot';
            if (i < state.currentStep) cls += ' completed';
            if (i === state.currentStep) cls += ' active';
            html += '<div class="ev-step-item">';
            html += '<div class="' + cls + '">' + (i + 1) + '</div>';
            html += '<span class="ev-step-label">' + STEP_LABELS[i] + '</span>';
            html += '</div>';
            if (i < STEP_LABELS.length - 1) {
                var lineCls = 'ev-step-line';
                if (i < state.currentStep) lineCls += ' completed';
                html += '<div class="' + lineCls + '"></div>';
            }
        }
        container.innerHTML = html;
    }

    function renderStepNav() {
        var container = document.getElementById('ev-step-nav');
        if (!container) return;

        var html = '';
        if (state.currentStep > 0) {
            html += '<button type="button" class="ev-step-prev-btn" id="ev-prev-btn">&larr; Vorige</button>';
        } else {
            html += '<span></span>';
        }
        if (state.currentStep < STEP_LABELS.length - 1) {
            html += '<button type="button" class="ev-step-next-btn" id="ev-next-btn">Volgende &rarr;</button>';
        } else {
            html += '<span></span>';
        }
        container.innerHTML = html;
    }

    function setStep(step) {
        if (step < 0 || step >= STEP_LABELS.length) return;
        state.currentStep = step;

        var panels = document.querySelectorAll('.ev-step-panel');
        for (var i = 0; i < panels.length; i++) {
            panels[i].style.display = parseInt(panels[i].getAttribute('data-step'), 10) === step ? '' : 'none';
        }

        renderStepBar();
        renderStepNav();

        // Re-render step content when switching
        if (step === 1) {
            renderAppointmentConfigs();
        }
        if (step === 2) {
            renderPregnancy();
            renderDatePickers();
        }
        if (step === 3) {
            fetchAvailableSlots();
        }
    }

    /* =========================================================
       STEP 0 – MAIN CONFIGURATOR (appointment 0)
       ========================================================= */
    function renderIncludedGrid() {
        var container = document.getElementById('ev-included-grid');
        if (!container) return;
        var duration = state.appointments[0].duration;
        var cards = buildIncludedCards(duration);
        var html = '';
        for (var i = 0; i < cards.length; i++) {
            var c = cards[i];
            var locked = duration < c.unlockAt;
            html += '<div class="ev-included-card' + (locked ? ' locked' : '') + '">';
            html += '<span class="ev-inc-icon">' + c.icon + '</span>';
            html += '<span class="ev-inc-name">' + c.name + '</span>';
            html += '<span class="ev-inc-detail">' + c.detail + '</span>';
            if (!locked && c.free) {
                html += '<span class="ev-inc-badge free">Inbegrepen</span>';
            } else if (locked) {
                html += '<span class="ev-inc-badge unlock">Vanaf ' + c.unlockAt + ' min</span>';
            }
            html += '</div>';
        }
        container.innerHTML = html;
    }

    function renderAddons() {
        var container = document.getElementById('ev-addons-list');
        if (!container) return;
        var apt = state.appointments[0];
        var addons = buildAddons(apt.duration);
        var html = '';

        for (var i = 0; i < addons.length; i++) {
            var a = addons[i];
            var addonState = apt.addons[a.id] || { qty: 0 };

            if (a.autoSelected && !apt.addons[a.id]) {
                apt.addons[a.id] = { qty: 1 };
                addonState = apt.addons[a.id];
            }

            var selected = addonState.qty > 0;
            var disabled = !a.enabled;

            if (a.type === 'toggle') {
                html += '<div class="ev-addon-row' + (selected ? ' selected' : '') + (disabled ? ' disabled' : '') + '" data-addon-id="' + a.id + '" data-type="toggle" data-apt="0">';
                html += '<span class="ev-addon-check">' + (selected ? '&#10003;' : '') + '</span>';
                html += '<div class="ev-addon-info"><span class="ev-addon-name">' + a.name + '</span>';
                html += '<span class="ev-addon-desc">' + a.desc + '</span></div>';
                html += '<span class="ev-addon-price' + (a.unitPrice === 0 ? ' is-free' : '') + '">' + (a.unitPrice === 0 ? 'Gratis' : euro(a.unitPrice)) + '</span>';
                html += '</div>';
            } else {
                html += '<div class="ev-addon-row' + (selected ? ' selected' : '') + (disabled ? ' disabled' : '') + '" data-addon-id="' + a.id + '" data-type="qty" data-max="' + a.maxQty + '" data-apt="0">';
                html += '<span class="ev-addon-check">' + (selected ? '&#10003;' : '') + '</span>';
                html += '<div class="ev-addon-info"><span class="ev-addon-name">' + a.name + '</span>';
                html += '<span class="ev-addon-desc">' + a.desc + '</span></div>';
                html += '<div class="ev-qty-stepper">';
                html += '<button type="button" class="ev-qty-minus" data-addon-id="' + a.id + '" data-apt="0">&minus;</button>';
                html += '<span class="ev-qty-val">' + addonState.qty + '</span>';
                html += '<button type="button" class="ev-qty-plus" data-addon-id="' + a.id + '" data-apt="0">&plus;</button>';
                html += '</div>';
                html += '<span class="ev-addon-price">' + euro(a.unitPrice * addonState.qty) + '</span>';
                html += '</div>';
            }
        }
        container.innerHTML = html;
    }

    /* =========================================================
       STEP 1 – APPOINTMENT CONFIGS (per-appointment)
       ========================================================= */
    function renderAppointmentConfigs() {
        var container = document.getElementById('ev-apt-configs');
        if (!container) return;

        syncAppointmentCount();
        var html = '';

        for (var i = 0; i < state.packageQty; i++) {
            var apt = state.appointments[i];
            var cfg = getEffectiveConfig(i);

            html += '<div class="ev-apt-card" data-apt="' + i + '">';
            html += '<div class="ev-apt-card-header">';
            html += '<span class="ev-apt-card-number">' + (i + 1) + '</span>';
            html += '<span class="ev-apt-card-title">Afspraak ' + (i + 1) + '</span>';

            // Show summary of config
            html += '<span class="ev-apt-card-summary">' + cfg.duration + ' min';
            html += ' &middot; vanaf ' + euro(standardPrice(cfg.duration)) + '</span>';
            html += '</div>';

            if (i > 0) {
                // Toggle: same as apt 1 OR customize
                html += '<div class="ev-apt-toggle-bar">';
                html += '<button type="button" class="ev-apt-toggle-btn' + (!apt.customized ? ' active' : '') + '" data-apt="' + i + '" data-action="inherit">Zelfde als afspraak 1</button>';
                html += '<button type="button" class="ev-apt-toggle-btn' + (apt.customized ? ' active' : '') + '" data-apt="' + i + '" data-action="customize">Aanpassen</button>';
                html += '</div>';
            }

            // Show mini-configurator if appointment 0 or customized
            if (i === 0 || apt.customized) {
                html += renderMiniConfigurator(i, cfg);
            }

            html += '</div>';
        }

        container.innerHTML = html;

        // Bind mini-configurator sliders
        for (var j = 0; j < state.packageQty; j++) {
            if (j === 0 || state.appointments[j].customized) {
                bindMiniSlider(j);
            }
        }
    }

    function renderMiniConfigurator(aptIdx, cfg) {
        var html = '<div class="ev-apt-mini-config" data-apt="' + aptIdx + '">';

        // Duration slider
        html += '<div class="ev-apt-mini-row">';
        html += '<label class="ev-label">Duur</label>';
        html += '<div class="ev-slider-wrap">';
        html += '<input type="range" class="ev-mini-slider" data-apt="' + aptIdx + '" min="10" max="60" step="10" value="' + cfg.duration + '">';
        html += '<div class="ev-slider-labels" aria-hidden="true">';
        html += '<span>10</span><span>20</span><span>30</span><span>40</span><span>50</span><span>60</span>';
        html += '</div>';
        html += '</div>';
        html += '<div class="ev-duration-display"><span class="ev-mini-duration-val" data-apt="' + aptIdx + '">' + cfg.duration + '</span> minuten</div>';
        html += '</div>';

        // Addons
        var addons = buildAddons(cfg.duration);
        html += '<div class="ev-apt-mini-row">';
        html += '<label class="ev-label">Extra opties</label>';
        html += '<div class="ev-addons-list ev-mini-addons" data-apt="' + aptIdx + '">';
        for (var i = 0; i < addons.length; i++) {
            var a = addons[i];
            var addonState = cfg.addons[a.id] || { qty: 0 };
            if (a.autoSelected && !cfg.addons[a.id]) {
                cfg.addons[a.id] = { qty: 1 };
                // If this is a real appointment (idx 0 or customized), also write to state
                if (aptIdx === 0 || state.appointments[aptIdx].customized) {
                    state.appointments[aptIdx].addons[a.id] = { qty: 1 };
                }
                addonState = cfg.addons[a.id];
            }
            var selected = addonState.qty > 0;
            var disabled = !a.enabled;

            if (a.type === 'toggle') {
                html += '<div class="ev-addon-row' + (selected ? ' selected' : '') + (disabled ? ' disabled' : '') + '" data-addon-id="' + a.id + '" data-type="toggle" data-apt="' + aptIdx + '">';
                html += '<span class="ev-addon-check">' + (selected ? '&#10003;' : '') + '</span>';
                html += '<div class="ev-addon-info"><span class="ev-addon-name">' + a.name + '</span>';
                html += '<span class="ev-addon-desc">' + a.desc + '</span></div>';
                html += '<span class="ev-addon-price' + (a.unitPrice === 0 ? ' is-free' : '') + '">' + (a.unitPrice === 0 ? 'Gratis' : euro(a.unitPrice)) + '</span>';
                html += '</div>';
            } else {
                html += '<div class="ev-addon-row' + (selected ? ' selected' : '') + (disabled ? ' disabled' : '') + '" data-addon-id="' + a.id + '" data-type="qty" data-max="' + a.maxQty + '" data-apt="' + aptIdx + '">';
                html += '<span class="ev-addon-check">' + (selected ? '&#10003;' : '') + '</span>';
                html += '<div class="ev-addon-info"><span class="ev-addon-name">' + a.name + '</span>';
                html += '<span class="ev-addon-desc">' + a.desc + '</span></div>';
                html += '<div class="ev-qty-stepper">';
                html += '<button type="button" class="ev-qty-minus" data-addon-id="' + a.id + '" data-apt="' + aptIdx + '">&minus;</button>';
                html += '<span class="ev-qty-val">' + addonState.qty + '</span>';
                html += '<button type="button" class="ev-qty-plus" data-addon-id="' + a.id + '" data-apt="' + aptIdx + '">&plus;</button>';
                html += '</div>';
                html += '<span class="ev-addon-price">' + euro(a.unitPrice * addonState.qty) + '</span>';
                html += '</div>';
            }
        }
        html += '</div>';
        html += '</div>';

        html += '</div>';
        return html;
    }

    function bindMiniSlider(aptIdx) {
        var slider = document.querySelector('.ev-mini-slider[data-apt="' + aptIdx + '"]');
        if (!slider) return;
        slider.addEventListener('input', function () {
            var val = parseInt(this.value, 10);
            state.appointments[aptIdx].duration = val;
            var label = document.querySelector('.ev-mini-duration-val[data-apt="' + aptIdx + '"]');
            if (label) label.textContent = val;
            resetAutoSelectionsForApt(aptIdx);
            renderAppointmentConfigs();
            renderSummary();
        });
    }

    function sessionPriceForApt(aptIdx) {
        var cfg = getEffectiveConfig(aptIdx);
        var ts = getTimeSlotForApt(aptIdx);
        // If no slot selected yet, use standard (evening) price
        var base = sessionPrice(cfg.duration, ts === 'unknown' ? 'evening' : ts);
        var addonsTotal = 0;
        var addons = buildAddons(cfg.duration);
        for (var i = 0; i < addons.length; i++) {
            var a = addons[i];
            var addonState = cfg.addons[a.id] || { qty: 0 };
            if (addonState.qty > 0 && a.unitPrice > 0) {
                addonsTotal += a.unitPrice * addonState.qty;
            }
        }
        return base + addonsTotal;
    }

    /* =========================================================
       STEP 2 – PREGNANCY & DATES
       ========================================================= */
    function renderPregnancy() {
        var infoEl = document.getElementById('ev-preg-info');
        if (!infoEl) return;

        var currentWeek = getCurrentWeek();
        if (currentWeek === null) {
            infoEl.innerHTML = '';
            return;
        }

        var dueDate = getDueDate();
        var weeksLeft = PREGNANCY_WEEKS - currentWeek;
        var html = '';

        html += '<div class="ev-preg-week-display">';
        html += 'Je bent nu <strong>' + currentWeek + ' weken</strong> zwanger';
        if (weeksLeft > 0) {
            html += ' <span class="ev-preg-weeks-left">(nog ' + weeksLeft + ' weken te gaan';
            if (dueDate) html += ' \u2014 uitgerekend ' + formatDateNL(dueDate);
            html += ')</span>';
        }
        html += '</div>';

        html += '<div class="ev-milestone-timeline">';
        for (var i = 0; i < MILESTONES.length; i++) {
            var ms = MILESTONES[i];
            var status = getMilestoneStatus(ms, currentWeek);
            var statusIcon, statusLabel;

            if (status === 'past') {
                statusIcon = '\u2705';
                statusLabel = 'Al mogelijk geweest';
            } else if (status === 'current') {
                statusIcon = '\uD83C\uDFAF';
                statusLabel = 'Nu ideaal!';
            } else {
                var weeksUntil = ms.weekStart - currentWeek;
                statusIcon = '\u23F3';
                statusLabel = 'Over ' + weeksUntil + ' weken';
            }

            var dateRange = '';
            var startDate = getDateForWeek(ms.weekStart);
            var endDate = getDateForWeek(ms.weekEnd);
            if (startDate && endDate) {
                dateRange = formatDateNL(startDate) + ' \u2013 ' + formatDateNL(endDate);
            }

            html += '<div class="ev-milestone-card ev-ms-' + status + '">';
            html += '<span class="ev-ms-icon">' + ms.icon + '</span>';
            html += '<span class="ev-ms-name">' + ms.name + '</span>';
            html += '<span class="ev-ms-weeks">Week ' + ms.weekStart + '\u2013' + ms.weekEnd + '</span>';
            if (dateRange) {
                html += '<span class="ev-ms-dates">' + dateRange + '</span>';
            }
            html += '<span class="ev-ms-status">' + statusIcon + ' ' + statusLabel + '</span>';
            html += '</div>';
        }
        html += '</div>';

        infoEl.innerHTML = html;
    }

    function renderDatePickers() {
        var container = document.getElementById('ev-dates-container');
        if (!container) return;

        syncAppointmentCount();
        var qty = state.packageQty;
        var suggestions = suggestAppointmentDates(qty);
        var minDate = formatDateISO(new Date(today().getTime() + DAY_MS));
        var html = '';

        for (var i = 0; i < qty; i++) {
            var apt = state.appointments[i];
            var label = qty === 1
                ? 'Kies je afspraakdatum'
                : 'Afspraak ' + (i + 1);
            var sug = suggestions[i] || null;

            html += '<div class="ev-date-group">';
            html += '<label class="ev-date-label">' + label + '</label>';

            if (sug) {
                var sugISO = formatDateISO(sug.idealDate);
                html += '<div class="ev-date-suggestion">';
                html += '<span class="ev-date-sug-icon">' + sug.milestone.icon + '</span> ';
                html += '<span class="ev-date-sug-text">';
                html += sug.milestone.desc;
                html += ' \u2014 plan rond <strong>' + formatDateNL(sug.idealDate) + '</strong>';
                html += ' <span class="ev-date-sug-range">(week ' + sug.milestone.weekStart + '\u2013' + sug.milestone.weekEnd + ')</span>';
                html += '<br><button type="button" class="ev-date-sug-btn" data-idx="' + i + '" data-date="' + sugISO + '">Kies ' + formatDateNL(sug.idealDate) + '</button>';
                html += '</span>';
                html += '</div>';
            }

            html += '<input type="date" class="ev-date-input" data-idx="' + i + '" value="' + apt.date + '" min="' + minDate + '">';
            html += '</div>';
        }

        container.innerHTML = html;
    }

    /* =========================================================
       STEP 3 – TIMESLOT SELECTION (fetched from Bookly via AJAX)
       ========================================================= */
    function isWordPress() {
        return typeof echovisieBooking !== 'undefined' && echovisieBooking.ajaxUrl;
    }

    function fetchAvailableSlots() {
        if (!isWordPress()) return;

        state.slotsLoading = true;
        state.slotsError = null;
        renderTimeslots();

        syncAppointmentCount();
        var aptData = [];
        for (var i = 0; i < state.packageQty; i++) {
            var cfg = getEffectiveConfig(i);
            aptData.push({
                duration: cfg.duration,
                date: state.appointments[i].date
            });
        }

        var formData = new FormData();
        formData.append('action', 'echovisie_get_slots');
        formData.append('nonce', echovisieBooking.nonce);
        formData.append('config', JSON.stringify({
            packageQty: state.packageQty,
            appointments: aptData
        }));

        fetch(echovisieBooking.ajaxUrl, { method: 'POST', body: formData })
            .then(function (res) { return res.json(); })
            .then(function (resp) {
                state.slotsLoading = false;
                if (resp.success && resp.data && resp.data.slots) {
                    // Parse new structure: { aptIdx: { slots: [...], alternatives: [...] } }
                    state.availableSlots = {};
                    state.alternativeDates = {};
                    var rawSlots = resp.data.slots;
                    for (var key in rawSlots) {
                        if (rawSlots.hasOwnProperty(key)) {
                            var entry = rawSlots[key];
                            if (Array.isArray(entry)) {
                                // Legacy format (plain array)
                                state.availableSlots[key] = entry;
                                state.alternativeDates[key] = [];
                            } else {
                                state.availableSlots[key] = entry.slots || [];
                                state.alternativeDates[key] = entry.alternatives || [];
                            }
                        }
                    }
                } else {
                    state.slotsError = (resp.data && resp.data.message) || 'Kon beschikbaarheid niet ophalen.';
                }
                renderTimeslots();
            })
            .catch(function () {
                state.slotsLoading = false;
                state.slotsError = 'Verbindingsfout. Probeer het opnieuw.';
                renderTimeslots();
            });
    }

    function renderTimeslots() {
        var container = document.getElementById('ev-timeslots-container');
        if (!container) return;

        syncAppointmentCount();
        var html = '';

        if (state.slotsLoading) {
            html += '<div class="ev-slots-loading">';
            html += '<div class="ev-loading-spinner"></div>';
            html += '<p>Beschikbaarheid ophalen bij Ida, Christel en Rianne...</p>';
            html += '</div>';
            container.innerHTML = html;
            return;
        }

        if (state.slotsError) {
            html += '<div class="ev-preg-error">' + state.slotsError + '</div>';
            html += '<button type="button" class="ev-slot-retry-btn" id="ev-retry-slots">Opnieuw proberen</button>';
            container.innerHTML = html;
            return;
        }

        if (!isWordPress()) {
            // Demo mode – no Bookly available
            html += '<div class="ev-slots-demo-notice">';
            html += '<p style="text-align:center;color:var(--ev-text-muted);padding:1rem;">';
            html += 'In de live-omgeving worden hier de beschikbare tijdsloten van ';
            html += '<strong>Ida, Christel en Rianne</strong> geladen vanuit Bookly.';
            html += '</p></div>';

            // Show dummy slots for demo purposes
            for (var d = 0; d < state.packageQty; d++) {
                var apt = state.appointments[d];
                var cfg = getEffectiveConfig(d);
                var label = state.packageQty > 1
                    ? 'Afspraak ' + (d + 1) + ' (' + cfg.duration + ' min)'
                    : 'Jouw echo (' + cfg.duration + ' min)';

                html += '<div class="ev-slot-group">';
                html += '<h4 class="ev-slot-group-title">' + label + '</h4>';

                if (apt.date) {
                    var dateObj = parseDate(apt.date);
                    var dayOfWeek = dateObj ? dateObj.getDay() : 1; // 0=Sun, 6=Sat

                    // Demo: simulate "no availability" on weekends to show alternatives
                    if (dayOfWeek === 0 || dayOfWeek === 6) {
                        html += '<p class="ev-slot-no-date">Geen beschikbare tijdsloten op <strong>' + formatDateNL(dateObj) + '</strong>.</p>';

                        // Generate 2 fake alternative dates (next Monday and Tuesday)
                        var daysToMon = dayOfWeek === 6 ? 2 : 1;
                        var alt1 = new Date(dateObj.getTime() + daysToMon * DAY_MS);
                        var alt2 = new Date(alt1.getTime() + DAY_MS);
                        var demoAlts = [
                            { date: formatDateISO(alt1), date_label: formatDateNL(alt1), slot_count: 18 },
                            { date: formatDateISO(alt2), date_label: formatDateNL(alt2), slot_count: 12 }
                        ];
                        html += renderAlternatives(d, demoAlts);
                    } else {
                        html += '<p class="ev-slot-date-label">Beschikbaar op <strong>' + formatDateNL(dateObj) + '</strong></p>';

                        var demoSlots = ['09:00', '09:10', '09:20', '09:30', '10:00', '10:10', '10:30', '11:00', '13:00', '13:10', '13:30', '14:00', '14:10', '17:00', '17:10', '17:30', '18:00', '19:00'];
                        var demoStaff = ['Ida', 'Christel', 'Rianne'];
                        html += '<div class="ev-slot-grid">';
                        for (var s = 0; s < demoSlots.length; s++) {
                            var staffName = demoStaff[s % 3];
                            var selectedCls = (state.selectedSlots[d] && state.selectedSlots[d].time === demoSlots[s]) ? ' selected' : '';
                            var daytimeCls = isDaytimeSlot(demoSlots[s]) ? ' ev-slot-daytime' : '';
                            html += '<button type="button" class="ev-slot-btn' + selectedCls + daytimeCls + '" data-apt="' + d + '" data-time="' + demoSlots[s] + '" data-staff="' + staffName + '">';
                            html += '<span class="ev-slot-time">' + demoSlots[s] + '</span>';
                            html += '<span class="ev-slot-staff">' + staffName + '</span>';
                            if (isDaytimeSlot(demoSlots[s])) {
                                html += '<span class="ev-slot-discount">\u2212\u20AC10</span>';
                            }
                            html += '</button>';
                        }
                        html += '</div>';
                    }
                } else {
                    html += '<p class="ev-slot-no-date">Kies eerst een gewenste datum in de vorige stap</p>';
                }
                html += '</div>';
            }

            container.innerHTML = html;
            return;
        }

        // Live mode – render fetched slots from Bookly
        for (var i = 0; i < state.packageQty; i++) {
            var aptLive = state.appointments[i];
            var cfgLive = getEffectiveConfig(i);
            var labelLive = state.packageQty > 1
                ? 'Afspraak ' + (i + 1) + ' (' + cfgLive.duration + ' min)'
                : 'Jouw echo (' + cfgLive.duration + ' min)';

            html += '<div class="ev-slot-group">';
            html += '<h4 class="ev-slot-group-title">' + labelLive + '</h4>';

            var slots = state.availableSlots[i] || [];
            var alts = state.alternativeDates[i] || [];

            if (!aptLive.date) {
                html += '<p class="ev-slot-no-date">Kies eerst een gewenste datum in de vorige stap</p>';
            } else if (slots.length === 0) {
                var origDate = parseDate(aptLive.date);
                html += '<p class="ev-slot-no-date">Geen beschikbare tijdsloten op <strong>' + formatDateNL(origDate) + '</strong>.</p>';

                // Show alternative dates if available
                if (alts.length > 0) {
                    html += renderAlternatives(i, alts);
                } else {
                    html += '<p class="ev-slot-no-date" style="margin-top:.5rem;">Er zijn de komende 14 dagen geen beschikbare tijdsloten gevonden. Kies een andere datum in de vorige stap.</p>';
                }
            } else {
                var dateObj2 = parseDate(aptLive.date);
                html += '<p class="ev-slot-date-label">Beschikbaar op <strong>' + formatDateNL(dateObj2) + '</strong></p>';
                html += '<div class="ev-slot-grid">';
                for (var j = 0; j < slots.length; j++) {
                    var slot = slots[j];
                    var isSelected = state.selectedSlots[i]
                        && state.selectedSlots[i].time === slot.time
                        && state.selectedSlots[i].staff_id === slot.staff_id;
                    var selCls = isSelected ? ' selected' : '';
                    var daytimeCls2 = isDaytimeSlot(slot.time) ? ' ev-slot-daytime' : '';
                    html += '<button type="button" class="ev-slot-btn' + selCls + daytimeCls2 + '" data-apt="' + i + '" data-time="' + slot.time + '" data-staff-id="' + slot.staff_id + '" data-staff="' + (slot.staff_name || '') + '">';
                    html += '<span class="ev-slot-time">' + slot.time + '</span>';
                    if (slot.staff_name) {
                        html += '<span class="ev-slot-staff">' + slot.staff_name + '</span>';
                    }
                    if (isDaytimeSlot(slot.time)) {
                        html += '<span class="ev-slot-discount">\u2212\u20AC10</span>';
                    }
                    html += '</button>';
                }
                html += '</div>';
            }

            html += '</div>';
        }

        container.innerHTML = html;
    }

    function renderAlternatives(aptIdx, alternatives) {
        var html = '';
        html += '<div class="ev-alt-dates">';
        html += '<p class="ev-alt-dates-label">Dichtstbijzijnde beschikbare data:</p>';
        html += '<div class="ev-alt-dates-grid">';
        for (var a = 0; a < alternatives.length; a++) {
            var alt = alternatives[a];
            html += '<button type="button" class="ev-alt-date-btn" data-apt="' + aptIdx + '" data-date="' + alt.date + '">';
            html += '<span class="ev-alt-date-name">' + alt.date_label + '</span>';
            html += '<span class="ev-alt-date-count">' + alt.slot_count + ' tijdslot' + (alt.slot_count !== 1 ? 'en' : '') + ' beschikbaar</span>';
            html += '</button>';
        }
        html += '</div>';
        html += '</div>';
        return html;
    }

    function validateCustomerFields() {
        var errors = [];
        var nameEl  = document.getElementById('ev-customer-name');
        var emailEl = document.getElementById('ev-customer-email');
        var phoneEl = document.getElementById('ev-customer-phone');

        // Read current values from inputs
        if (nameEl) state.customerName = nameEl.value.trim();
        if (emailEl) state.customerEmail = emailEl.value.trim();
        if (phoneEl) state.customerPhone = phoneEl.value.trim();

        if (!state.customerName) errors.push('Vul je naam in.');
        if (!state.customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.customerEmail)) {
            errors.push('Vul een geldig e-mailadres in.');
        }
        if (!state.customerPhone) errors.push('Vul je telefoonnummer in.');

        // Toggle error class on fields
        if (nameEl) nameEl.classList.toggle('has-error', !state.customerName);
        if (emailEl) emailEl.classList.toggle('has-error', !state.customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.customerEmail));
        if (phoneEl) phoneEl.classList.toggle('has-error', !state.customerPhone);

        var errorEl = document.getElementById('ev-customer-error');
        if (errors.length > 0 && errorEl) {
            errorEl.textContent = errors.join(' ');
            errorEl.style.display = '';
        } else if (errorEl) {
            errorEl.style.display = 'none';
        }

        return errors.length === 0;
    }

    function submitBooking() {
        if (!isWordPress()) {
            // Demo fallback – show inline confirmation
            renderConfirmation(null);
            return;
        }

        if (!validateCustomerFields()) {
            return;
        }

        state.bookingInProgress = true;
        updateBookButton();

        syncAppointmentCount();
        var aptData = [];
        for (var j = 0; j < state.packageQty; j++) {
            var cfgJ = getEffectiveConfig(j);
            var slotJ = state.selectedSlots[j] || {};
            aptData.push({
                duration: cfgJ.duration,
                addons: cfgJ.addons,
                date: state.appointments[j].date,
                slotTime: slotJ.time || '',
                staffId: slotJ.staff_id || ''
            });
        }

        var formData = new FormData();
        formData.append('action', 'echovisie_book');
        formData.append('nonce', echovisieBooking.nonce);
        formData.append('config', JSON.stringify({
            packageQty: state.packageQty,
            appointments: aptData,
            pregType: state.pregType,
            pregDate: state.pregDate,
            customerName: state.customerName,
            customerEmail: state.customerEmail,
            customerPhone: state.customerPhone
        }));

        fetch(echovisieBooking.ajaxUrl, { method: 'POST', body: formData })
            .then(function (res) { return res.json(); })
            .then(function (resp) {
                state.bookingInProgress = false;
                updateBookButton();
                if (resp.success && resp.data) {
                    renderConfirmation(resp.data.appointments || []);
                } else {
                    var errMsg = (resp.data && resp.data.message) || 'Er ging iets mis. Probeer het opnieuw.';
                    alert(errMsg);
                }
            })
            .catch(function () {
                state.bookingInProgress = false;
                updateBookButton();
                alert('Verbindingsfout. Controleer je internetverbinding en probeer het opnieuw.');
            });
    }

    function renderConfirmation(serverApts) {
        var wrapper = document.getElementById('echovisie-booking');
        if (!wrapper) return;

        var calc = calculateTotal();
        var html = '';

        html += '<div class="ev-header" style="background:linear-gradient(135deg, #4CAF50, #388E3C);">';
        html += '<h2 class="ev-title">\u2705 Afspraak bevestigd!</h2>';
        html += '<p class="ev-subtitle">Je echo is succesvol ingepland</p>';
        html += '</div>';

        html += '<div class="ev-section" style="text-align:center;padding:1.5rem;">';
        if (state.customerName) {
            html += '<p style="font-size:1rem;font-weight:600;margin-bottom:.3rem;">Bedankt, ' + state.customerName + '!</p>';
        }
        html += '<p style="font-size:.92rem;color:var(--ev-text-muted);margin-bottom:1.2rem;">';
        html += 'Hieronder vind je een overzicht van je afspra' + (state.packageQty > 1 ? 'ken' : 'ak') + '. ';
        if (state.customerEmail) {
            html += 'Een bevestiging is verstuurd naar <strong>' + state.customerEmail + '</strong>. ';
        }
        html += 'De betaling vindt plaats in de praktijk (pin/contant).';
        html += '</p>';

        for (var i = 0; i < state.packageQty; i++) {
            var cfg = getEffectiveConfig(i);
            var slot = state.selectedSlots[i] || {};
            var dateStr = state.appointments[i].date;
            var dateObj = parseDate(dateStr);

            // Use server data if available, else fall back to local state
            var staffName = slot.staff || '';
            var dateLabel = dateObj ? formatDateNL(dateObj) : dateStr;
            if (serverApts && serverApts[i]) {
                if (serverApts[i].staff_name) staffName = serverApts[i].staff_name;
                if (serverApts[i].date_label) dateLabel = serverApts[i].date_label;
            }

            html += '<div class="ev-apt-card" style="text-align:left;margin-bottom:.8rem;">';
            html += '<div class="ev-apt-card-header">';
            html += '<span class="ev-apt-card-number">' + (i + 1) + '</span>';
            html += '<span class="ev-apt-card-title">' + (state.packageQty > 1 ? 'Afspraak ' + (i + 1) : 'Jouw echo') + '</span>';
            html += '</div>';
            html += '<div class="ev-apt-mini-config">';
            html += '<p style="margin:.4rem 0;font-size:.88rem;"><strong>Datum:</strong> ' + dateLabel + '</p>';
            html += '<p style="margin:.4rem 0;font-size:.88rem;"><strong>Tijd:</strong> ' + (slot.time || '–') + '</p>';
            html += '<p style="margin:.4rem 0;font-size:.88rem;"><strong>Duur:</strong> ' + cfg.duration + ' minuten</p>';
            if (staffName) {
                html += '<p style="margin:.4rem 0;font-size:.88rem;"><strong>Echoscopist:</strong> ' + staffName + '</p>';
            }
            html += '</div>';
            html += '</div>';
        }

        html += '<div style="margin-top:1rem;padding:.8rem 1rem;background:var(--ev-primary-light);border-radius:10px;display:inline-block;">';
        html += '<span style="font-size:1rem;font-weight:700;color:var(--ev-primary-dark);">Totaal: ' + euro(calc.total) + '</span>';
        html += '<span style="font-size:.82rem;color:var(--ev-text-muted);margin-left:.5rem;">(te betalen in de praktijk)</span>';
        html += '</div>';

        html += '</div>';

        wrapper.innerHTML = html;

        // Hide the sidebar book button
        var sidebar = document.querySelector('.ev-sidebar');
        if (sidebar) sidebar.style.display = 'none';
    }

    function updateBookButton() {
        var btn = document.getElementById('ev-book-btn');
        if (!btn) return;
        if (state.bookingInProgress) {
            btn.disabled = true;
            btn.textContent = 'Bezig met boeken...';
        } else {
            btn.disabled = false;
            btn.textContent = 'Afspraak boeken';
        }
    }

    /* =========================================================
       PRICE SUMMARY (iterates over all appointments)
       ========================================================= */
    function calculateTotal() {
        syncAppointmentCount();
        var qty = state.packageQty;
        var lines = [];
        var rawTotal = 0;

        for (var i = 0; i < qty; i++) {
            var cfg = getEffectiveConfig(i);
            var base = standardPrice(cfg.duration);
            var ts = getTimeSlotForApt(i);
            var isDaytime = ts === 'working';
            var aptLabel = qty > 1 ? 'Afspraak ' + (i + 1) + ': ' : '';

            lines.push({ label: aptLabel + 'Echo ' + cfg.duration + ' min', amount: base });

            if (isDaytime) {
                lines.push({ label: aptLabel + 'Dagkorting \u2600\uFE0F', amount: -DAYTIME_DISCOUNT, isDiscount: true });
            }

            var addons = buildAddons(cfg.duration);
            for (var j = 0; j < addons.length; j++) {
                var a = addons[j];
                var addonState = cfg.addons[a.id] || { qty: 0 };
                if (addonState.qty > 0 && a.unitPrice > 0) {
                    var cost = a.unitPrice * addonState.qty;
                    var qtyLabel = addonState.qty > 1 ? ' x' + addonState.qty : '';
                    lines.push({ label: aptLabel + a.name + qtyLabel, amount: cost });
                }
            }

            rawTotal += sessionPriceForApt(i);
        }

        var disc = packageDiscount(qty);
        var discountAmount = rawTotal * disc;
        var total = rawTotal - discountAmount;

        return {
            lines: lines,
            qty: qty,
            discount: disc,
            discountAmount: discountAmount,
            total: total
        };
    }

    function renderSummary() {
        var calc = calculateTotal();
        var container = document.getElementById('ev-summary');
        var totalEl = document.getElementById('ev-total-amount');
        if (!container || !totalEl) return;

        var html = '';
        for (var i = 0; i < calc.lines.length; i++) {
            var l = calc.lines[i];
            var cls = 'ev-summary-row';
            if (l.isDiscount) cls += ' discount';
            var amountStr = l.amount < 0
                ? '&minus; ' + euro(Math.abs(l.amount))
                : euro(l.amount);
            html += '<div class="' + cls + '"><span>' + l.label + '</span><span>' + amountStr + '</span></div>';
        }
        if (calc.discountAmount > 0) {
            html += '<div class="ev-summary-row discount"><span>Pakketkorting (' + Math.round(calc.discount * 100) + '%)</span><span>&minus; ' + euro(calc.discountAmount) + '</span></div>';
        }
        container.innerHTML = html;
        totalEl.textContent = euro(calc.total);
    }

    function renderAll() {
        renderStepBar();
        renderStepNav();

        if (state.currentStep === 0) {
            renderIncludedGrid();
            renderAddons();
        }
        if (state.currentStep === 1) {
            renderAppointmentConfigs();
        }
        if (state.currentStep === 2) {
            renderPregnancy();
            renderDatePickers();
        }
        if (state.currentStep === 3) {
            renderTimeslots();
        }
        renderSummary();
    }

    /* =========================================================
       AUTO-SELECTION HELPERS
       ========================================================= */
    function resetAutoSelectionsForApt(aptIdx) {
        var apt = state.appointments[aptIdx];
        var autoKeys = ['recording', 'usb'];
        var addons = buildAddons(apt.duration);
        for (var i = 0; i < addons.length; i++) {
            var a = addons[i];
            if (autoKeys.indexOf(a.id) !== -1) {
                if (a.autoSelected) {
                    apt.addons[a.id] = { qty: 1 };
                }
            }
        }
    }

    /* =========================================================
       ADDON CLICK HANDLER (works for both main and mini addons)
       ========================================================= */
    function handleAddonClick(e, container) {
        var row = e.target.closest('.ev-addon-row');
        if (!row || row.classList.contains('disabled')) return;

        var id = row.getAttribute('data-addon-id');
        var type = row.getAttribute('data-type');
        var aptIdx = parseInt(row.getAttribute('data-apt') || '0', 10);
        var apt = state.appointments[aptIdx];

        if (type === 'toggle') {
            if (!apt.addons[id]) apt.addons[id] = { qty: 0 };
            apt.addons[id].qty = apt.addons[id].qty > 0 ? 0 : 1;
            renderAll();
            return;
        }

        var maxQty = parseInt(row.getAttribute('data-max') || '99', 10);
        if (!apt.addons[id]) apt.addons[id] = { qty: 0 };

        if (e.target.closest('.ev-qty-minus')) {
            apt.addons[id].qty = Math.max(0, apt.addons[id].qty - 1);
            renderAll();
        } else if (e.target.closest('.ev-qty-plus')) {
            apt.addons[id].qty = Math.min(maxQty, apt.addons[id].qty + 1);
            renderAll();
        } else if (!e.target.closest('.ev-qty-stepper')) {
            apt.addons[id].qty = apt.addons[id].qty > 0 ? 0 : 1;
            renderAll();
        }
    }

    /* =========================================================
       DEEP COPY HELPER
       ========================================================= */
    function deepCopyAddons(addons) {
        var copy = {};
        for (var key in addons) {
            if (addons.hasOwnProperty(key)) {
                copy[key] = { qty: addons[key].qty };
            }
        }
        return copy;
    }

    /* =========================================================
       EVENT HANDLERS
       ========================================================= */
    function init() {
        var slider = document.getElementById('ev-duration-slider');
        var durationLabel = document.getElementById('ev-duration-value');

        if (!slider) return;

        // Initialize step display
        setStep(0);

        // Duration slider (step 0 main slider)
        slider.addEventListener('input', function () {
            state.appointments[0].duration = parseInt(this.value, 10);
            if (durationLabel) durationLabel.textContent = state.appointments[0].duration;
            resetAutoSelectionsForApt(0);
            renderIncludedGrid();
            renderAddons();
            renderSummary();
        });

        // Package buttons
        document.querySelectorAll('.ev-package-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.ev-package-btn').forEach(function (b) { b.classList.remove('active'); });
                this.classList.add('active');
                state.packageQty = parseInt(this.getAttribute('data-qty'), 10);
                syncAppointmentCount();
                renderSummary();
            });
        });

        // Addon clicks (step 0, delegated)
        var addonsListMain = document.getElementById('ev-addons-list');
        if (addonsListMain) {
            addonsListMain.addEventListener('click', function (e) {
                handleAddonClick(e, this);
            });
        }

        // Step 1 delegated events (appointment configs)
        var aptConfigs = document.getElementById('ev-apt-configs');
        if (aptConfigs) {
            aptConfigs.addEventListener('click', function (e) {
                // Inherit / Customize toggle
                var toggleBtn = e.target.closest('.ev-apt-toggle-btn');
                if (toggleBtn) {
                    var aptIdx = parseInt(toggleBtn.getAttribute('data-apt'), 10);
                    var action = toggleBtn.getAttribute('data-action');
                    if (action === 'inherit') {
                        state.appointments[aptIdx].customized = false;
                    } else if (action === 'customize') {
                        if (!state.appointments[aptIdx].customized) {
                            // Deep copy from appointment 0
                            var src = state.appointments[0];
                            state.appointments[aptIdx].duration = src.duration;
                            state.appointments[aptIdx].addons = deepCopyAddons(src.addons);
                            state.appointments[aptIdx].customized = true;
                        }
                    }
                    renderAppointmentConfigs();
                    renderSummary();
                    return;
                }

                // Addon clicks inside mini-config
                handleAddonClick(e, aptConfigs);
            });
        }

        // Step navigation (delegated)
        var stepNav = document.getElementById('ev-step-nav');
        if (stepNav) {
            stepNav.addEventListener('click', function (e) {
                if (e.target.id === 'ev-next-btn' || e.target.closest('#ev-next-btn')) {
                    setStep(state.currentStep + 1);
                    renderSummary();
                }
                if (e.target.id === 'ev-prev-btn' || e.target.closest('#ev-prev-btn')) {
                    setStep(state.currentStep - 1);
                    renderSummary();
                }
            });
        }

        // Pregnancy type toggles
        document.querySelectorAll('.ev-preg-toggle').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.ev-preg-toggle').forEach(function (b) { b.classList.remove('active'); });
                this.classList.add('active');
                state.pregType = this.getAttribute('data-preg-type');
                var wrapper = document.getElementById('ev-preg-date-wrapper');
                if (wrapper) wrapper.style.display = '';
                renderPregnancy();
                renderDatePickers();
            });
        });

        // Pregnancy date input
        var pregInput = document.getElementById('ev-preg-date-input');
        if (pregInput) {
            pregInput.addEventListener('change', function () {
                state.pregDate = this.value;
                var error = validatePregDate();
                var errorEl = document.getElementById('ev-preg-date-error');
                if (error) {
                    this.classList.add('has-error');
                    if (!errorEl) {
                        errorEl = document.createElement('div');
                        errorEl.id = 'ev-preg-date-error';
                        errorEl.className = 'ev-preg-error';
                        this.parentNode.appendChild(errorEl);
                    }
                    errorEl.textContent = error;
                } else {
                    this.classList.remove('has-error');
                    if (errorEl) errorEl.remove();
                }
                renderPregnancy();
                renderDatePickers();
            });
        }

        // Appointment date inputs (delegated)
        var datesContainer = document.getElementById('ev-dates-container');
        if (datesContainer) {
            datesContainer.addEventListener('change', function (e) {
                if (e.target.classList.contains('ev-date-input')) {
                    var idx = parseInt(e.target.getAttribute('data-idx'), 10);
                    state.appointments[idx].date = e.target.value;
                }
            });
            datesContainer.addEventListener('click', function (e) {
                var btn = e.target.closest('.ev-date-sug-btn');
                if (!btn) return;
                var idx = parseInt(btn.getAttribute('data-idx'), 10);
                var date = btn.getAttribute('data-date');
                state.appointments[idx].date = date;
                renderDatePickers();
            });
        }

        // Timeslot selection (step 3, delegated)
        var timeslotsContainer = document.getElementById('ev-timeslots-container');
        if (timeslotsContainer) {
            timeslotsContainer.addEventListener('click', function (e) {
                var slotBtn = e.target.closest('.ev-slot-btn');
                if (slotBtn) {
                    var aptIdx = parseInt(slotBtn.getAttribute('data-apt'), 10);
                    state.selectedSlots[aptIdx] = {
                        time: slotBtn.getAttribute('data-time'),
                        staff_id: slotBtn.getAttribute('data-staff-id') || '',
                        staff: slotBtn.getAttribute('data-staff') || ''
                    };
                    renderTimeslots();
                    renderSummary();
                    return;
                }

                // Alternative date button – switch appointment date and re-fetch
                var altBtn = e.target.closest('.ev-alt-date-btn');
                if (altBtn) {
                    var altAptIdx = parseInt(altBtn.getAttribute('data-apt'), 10);
                    var altDate = altBtn.getAttribute('data-date');
                    state.appointments[altAptIdx].date = altDate;
                    // Clear any previous selection for this appointment
                    delete state.selectedSlots[altAptIdx];
                    // Re-fetch slots with the new date
                    fetchAvailableSlots();
                    return;
                }

                // Retry button
                if (e.target.id === 'ev-retry-slots' || e.target.closest('#ev-retry-slots')) {
                    fetchAvailableSlots();
                }
            });
        }

        // Customer fields
        var custName = document.getElementById('ev-customer-name');
        var custEmail = document.getElementById('ev-customer-email');
        var custPhone = document.getElementById('ev-customer-phone');
        if (custName) {
            custName.addEventListener('input', function () { state.customerName = this.value.trim(); });
        }
        if (custEmail) {
            custEmail.addEventListener('input', function () { state.customerEmail = this.value.trim(); });
        }
        if (custPhone) {
            custPhone.addEventListener('input', function () { state.customerPhone = this.value.trim(); });
        }

        // Book button
        var bookBtn = document.getElementById('ev-book-btn');
        if (bookBtn) {
            bookBtn.addEventListener('click', function () {
                submitBooking();
            });
        }

        // Initial render
        renderAll();
    }

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
