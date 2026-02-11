/**
 * EchoVisie Booking Widget – Interactive logic & pricing engine
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

    /* =========================================================
       STATE
       ========================================================= */
    var state = {
        duration: 10,
        timeSlot: 'working',
        packageQty: 1,
        addons: {},
        pregType: null,          // 'due' | 'lmp' | null
        pregDate: '',            // YYYY-MM-DD
        appointmentDates: ['']   // one entry per packageQty
    };

    /* =========================================================
       PRICING RULES
       ========================================================= */
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
       PREGNANCY CALCULATOR
       ========================================================= */
    function getLmpDate() {
        if (!state.pregType || !state.pregDate) return null;
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
    function buildIncludedCards(duration) {
        return [
            // 10 min
            {
                icon: '\uD83D\uDCF7',
                name: 'Digitale 2D-beelden',
                detail: included2D(duration) + ' beelden inbegrepen',
                free: true,
                unlockAt: 10
            },
            // 20 min
            {
                icon: '\uD83D\uDDBC\uFE0F',
                name: 'Kleine foto\'s (print)',
                detail: freeSmallPhotos(duration) > 0
                    ? freeSmallPhotos(duration) + ' stuks inbegrepen'
                    : 'Beschikbaar als extra (\u20AC2/stuk)',
                free: freeSmallPhotos(duration) > 0,
                unlockAt: 20
            },
            {
                icon: '\uD83D\uDDBC\uFE0F',
                name: 'Grote foto (print)',
                detail: freeLargePhotos(duration) > 0
                    ? '1 stuk inbegrepen'
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
                    ? included3D(duration) + ' beelden inbegrepen'
                    : 'Ontgrendeld bij 20 min',
                free: included3D(duration) > 0,
                unlockAt: 20
            },
            // 30 min
            {
                icon: '\uD83C\uDFAC',
                name: '4D-video\'s',
                detail: included4D(duration) > 0
                    ? included4D(duration) + ' video(s) inbegrepen'
                    : 'Ontgrendeld bij 30 min',
                free: included4D(duration) > 0,
                unlockAt: 30
            },
            // 40 min
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

    function renderIncludedGrid() {
        var container = document.getElementById('ev-included-grid');
        if (!container) return;
        var cards = buildIncludedCards(state.duration);
        var html = '';
        for (var i = 0; i < cards.length; i++) {
            var c = cards[i];
            var locked = state.duration < c.unlockAt;
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
        var addons = buildAddons(state.duration);
        var html = '';

        for (var i = 0; i < addons.length; i++) {
            var a = addons[i];
            var addonState = state.addons[a.id] || { qty: 0 };

            if (a.autoSelected && !state.addons[a.id]) {
                state.addons[a.id] = { qty: 1 };
                addonState = state.addons[a.id];
            }

            var selected = addonState.qty > 0;
            var disabled = !a.enabled;

            if (a.type === 'toggle') {
                html += '<div class="ev-addon-row' + (selected ? ' selected' : '') + (disabled ? ' disabled' : '') + '" data-addon-id="' + a.id + '" data-type="toggle">';
                html += '<span class="ev-addon-check">' + (selected ? '&#10003;' : '') + '</span>';
                html += '<div class="ev-addon-info"><span class="ev-addon-name">' + a.name + '</span>';
                html += '<span class="ev-addon-desc">' + a.desc + '</span></div>';
                html += '<span class="ev-addon-price' + (a.unitPrice === 0 ? ' is-free' : '') + '">' + (a.unitPrice === 0 ? 'Gratis' : euro(a.unitPrice)) + '</span>';
                html += '</div>';
            } else {
                html += '<div class="ev-addon-row' + (selected ? ' selected' : '') + (disabled ? ' disabled' : '') + '" data-addon-id="' + a.id + '" data-type="qty" data-max="' + a.maxQty + '">';
                html += '<span class="ev-addon-check">' + (selected ? '&#10003;' : '') + '</span>';
                html += '<div class="ev-addon-info"><span class="ev-addon-name">' + a.name + '</span>';
                html += '<span class="ev-addon-desc">' + a.desc + '</span></div>';
                html += '<div class="ev-qty-stepper">';
                html += '<button type="button" class="ev-qty-minus" data-addon-id="' + a.id + '">&minus;</button>';
                html += '<span class="ev-qty-val">' + addonState.qty + '</span>';
                html += '<button type="button" class="ev-qty-plus" data-addon-id="' + a.id + '">&plus;</button>';
                html += '</div>';
                html += '<span class="ev-addon-price">' + euro(a.unitPrice * addonState.qty) + '</span>';
                html += '</div>';
            }
        }
        container.innerHTML = html;
    }

    /* =========================================================
       PREGNANCY SECTION RENDER
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

        // Current week display
        html += '<div class="ev-preg-week-display">';
        html += 'Je bent nu <strong>' + currentWeek + ' weken</strong> zwanger';
        if (weeksLeft > 0) {
            html += ' <span class="ev-preg-weeks-left">(nog ' + weeksLeft + ' weken te gaan';
            if (dueDate) html += ' \u2014 uitgerekend ' + formatDateNL(dueDate);
            html += ')</span>';
        }
        html += '</div>';

        // Milestone timeline
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

    /* =========================================================
       DATE PICKER RENDER
       ========================================================= */
    function renderDatePickers() {
        var container = document.getElementById('ev-dates-container');
        if (!container) return;

        var qty = state.packageQty;
        var suggestions = suggestAppointmentDates(qty);

        // Resize appointment dates array
        while (state.appointmentDates.length < qty) state.appointmentDates.push('');
        if (state.appointmentDates.length > qty) state.appointmentDates.length = qty;

        var minDate = formatDateISO(new Date(today().getTime() + DAY_MS));
        var html = '';

        for (var i = 0; i < qty; i++) {
            var label = qty === 1
                ? 'Kies je afspraakdatum'
                : 'Afspraak ' + (i + 1);
            var sug = suggestions[i] || null;

            html += '<div class="ev-date-group">';
            html += '<label class="ev-date-label">' + label + '</label>';

            if (sug) {
                html += '<div class="ev-date-suggestion">';
                html += '<span class="ev-date-sug-icon">' + sug.milestone.icon + '</span> ';
                html += '<span class="ev-date-sug-text">';
                html += sug.milestone.desc;
                html += ' \u2014 plan rond <strong>' + formatDateNL(sug.idealDate) + '</strong>';
                html += ' <span class="ev-date-sug-range">(week ' + sug.milestone.weekStart + '\u2013' + sug.milestone.weekEnd + ')</span>';
                html += '</span>';
                html += '</div>';
            }

            html += '<input type="date" class="ev-date-input" data-idx="' + i + '" value="' + state.appointmentDates[i] + '" min="' + minDate + '">';
            html += '</div>';
        }

        container.innerHTML = html;
    }

    /* =========================================================
       PRICE SUMMARY
       ========================================================= */
    function calculateTotal() {
        var duration = state.duration;
        var base = standardPrice(duration);
        var isDaytime = state.timeSlot === 'working';
        var addonsTotal = 0;
        var addons = buildAddons(duration);

        var lines = [];
        lines.push({ label: 'Echo ' + duration + ' min', amount: base });

        if (isDaytime) {
            lines.push({ label: 'Dagkorting \u2600\uFE0F', amount: -DAYTIME_DISCOUNT, isDiscount: true });
        }

        for (var i = 0; i < addons.length; i++) {
            var a = addons[i];
            var addonState = state.addons[a.id] || { qty: 0 };
            if (addonState.qty > 0 && a.unitPrice > 0) {
                var cost = a.unitPrice * addonState.qty;
                addonsTotal += cost;
                var qtyLabel = addonState.qty > 1 ? ' x' + addonState.qty : '';
                lines.push({ label: a.name + qtyLabel, amount: cost });
            }
        }

        var perSession = sessionPrice(duration, state.timeSlot) + addonsTotal;
        var qty = state.packageQty;
        var rawTotal = perSession * qty;
        var disc = packageDiscount(qty);
        var discountAmount = rawTotal * disc;
        var total = rawTotal - discountAmount;

        if (qty > 1) {
            lines.push({ label: qty + 'x afspraken subtotaal', amount: rawTotal });
        }

        return {
            lines: lines,
            perSession: perSession,
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
        renderIncludedGrid();
        renderAddons();
        renderPregnancy();
        renderDatePickers();
        renderSummary();
    }

    /* =========================================================
       EVENT HANDLERS
       ========================================================= */
    function init() {
        var slider = document.getElementById('ev-duration-slider');
        var durationLabel = document.getElementById('ev-duration-value');

        if (!slider) return;

        // Duration slider
        slider.addEventListener('input', function () {
            state.duration = parseInt(this.value, 10);
            if (durationLabel) durationLabel.textContent = state.duration;
            resetAutoSelections();
            renderAll();
        });

        // Time-of-day toggles
        document.querySelectorAll('.ev-toggle[data-time]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.ev-toggle[data-time]').forEach(function (b) { b.classList.remove('active'); });
                this.classList.add('active');
                state.timeSlot = this.getAttribute('data-time');
                renderAll();
            });
        });

        // Package buttons
        document.querySelectorAll('.ev-package-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.ev-package-btn').forEach(function (b) { b.classList.remove('active'); });
                this.classList.add('active');
                state.packageQty = parseInt(this.getAttribute('data-qty'), 10);
                renderAll();
            });
        });

        // Addon clicks (delegated)
        document.getElementById('ev-addons-list').addEventListener('click', function (e) {
            var row = e.target.closest('.ev-addon-row');
            if (!row || row.classList.contains('disabled')) return;

            var id = row.getAttribute('data-addon-id');
            var type = row.getAttribute('data-type');

            if (type === 'toggle') {
                if (!state.addons[id]) state.addons[id] = { qty: 0 };
                state.addons[id].qty = state.addons[id].qty > 0 ? 0 : 1;
                renderAll();
                return;
            }

            var maxQty = parseInt(row.getAttribute('data-max') || '99', 10);
            if (!state.addons[id]) state.addons[id] = { qty: 0 };

            if (e.target.closest('.ev-qty-minus')) {
                state.addons[id].qty = Math.max(0, state.addons[id].qty - 1);
                renderAll();
            } else if (e.target.closest('.ev-qty-plus')) {
                state.addons[id].qty = Math.min(maxQty, state.addons[id].qty + 1);
                renderAll();
            }
        });

        // Pregnancy type toggles
        document.querySelectorAll('.ev-preg-toggle').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.ev-preg-toggle').forEach(function (b) { b.classList.remove('active'); });
                this.classList.add('active');
                state.pregType = this.getAttribute('data-preg-type');
                var wrapper = document.getElementById('ev-preg-date-wrapper');
                if (wrapper) wrapper.style.display = '';
                renderAll();
            });
        });

        // Pregnancy date input
        var pregInput = document.getElementById('ev-preg-date-input');
        if (pregInput) {
            pregInput.addEventListener('change', function () {
                state.pregDate = this.value;
                renderAll();
            });
        }

        // Appointment date inputs (delegated)
        var datesContainer = document.getElementById('ev-dates-container');
        if (datesContainer) {
            datesContainer.addEventListener('change', function (e) {
                if (e.target.classList.contains('ev-date-input')) {
                    var idx = parseInt(e.target.getAttribute('data-idx'), 10);
                    state.appointmentDates[idx] = e.target.value;
                }
            });
        }

        // Book button
        document.getElementById('ev-book-btn').addEventListener('click', function () {
            var calc = calculateTotal();
            var msg = 'Bedankt voor je interesse! Je selectie:\n\n';
            msg += 'Duur: ' + state.duration + ' minuten\n';
            msg += 'Tijdstip: ' + (state.timeSlot === 'working' ? 'Overdag (€10 korting)' : 'Avond/Weekend') + '\n';
            msg += 'Aantal afspraken: ' + state.packageQty + '\n';

            for (var i = 0; i < state.appointmentDates.length; i++) {
                if (state.appointmentDates[i]) {
                    var d = parseDate(state.appointmentDates[i]);
                    msg += 'Datum ' + (i + 1) + ': ' + (d ? formatDateNL(d) : state.appointmentDates[i]) + '\n';
                }
            }

            msg += 'Totaal: ' + euro(calc.total) + '\n\n';
            msg += 'Neem contact op om je afspraak te bevestigen!';
            alert(msg);
        });

        // Initial render
        renderAll();
    }

    function resetAutoSelections() {
        var autoKeys = ['recording', 'usb'];
        var addons = buildAddons(state.duration);
        for (var i = 0; i < addons.length; i++) {
            var a = addons[i];
            if (autoKeys.indexOf(a.id) !== -1) {
                if (a.autoSelected) {
                    state.addons[a.id] = { qty: 1 };
                }
            }
        }
    }

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
