(function () {
    'use strict';

    /* ═══════════════════════════════════════════════════════
       EchoVisie Booking Wizard – Frontend
       ═══════════════════════════════════════════════════════ */

    var CFG = window.echovisieBooking || {};
    var PRICING = CFG.pricing || {};
    var CONTENT_RULES = CFG.contentRules || {};
    var STAFF = CFG.staff || [];
    var SERVICES = CFG.services || {};

    /* ── Constants ─────────────────────────────────────── */
    var MONTHS_NL = [
        'januari', 'februari', 'maart', 'april', 'mei', 'juni',
        'juli', 'augustus', 'september', 'oktober', 'november', 'december'
    ];
    var DAYS_NL = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
    var DURATIONS = [10, 20, 30, 40, 50, 60];

    var MILESTONES = [
        { id: 'gender', name: 'Geslachtsbepaling', weekStart: 15, weekEnd: 20, weekIdeal: 16, duration: 20, desc: 'Ideaal voor geslachtsbepaling' },
        { id: 'pretecho', name: 'Pretecho (3D/4D)', weekStart: 22, weekEnd: 29, weekIdeal: 28, duration: 40, desc: 'Optimaal voor 3D/4D-beelden' },
        { id: 'portrait', name: 'Portretecho', weekStart: 32, weekEnd: 36, weekIdeal: 34, duration: 30, desc: 'Gedetailleerde portretbeelden' }
    ];

    /* ── State ─────────────────────────────────────────── */
    var state = {
        currentStep: 0,
        pregType: 'due',
        pregDay: '',
        pregMonth: '',
        pregDate: null,         // Date object
        pregnancyWeek: null,
        dueDate: null,          // Date object

        selectedSuggestion: null,   // index or 'custom'
        packageQty: 1,

        appointments: [createEmptyAppt()],

        // Slots per appointment index
        slotsData: {},
        slotsLoading: {},

        // Customer
        customerFirstName: '',
        customerLastName: '',
        customerEmail: '',
        customerPhone: '',
        customerNotes: '',

        bookingInProgress: false
    };

    function createEmptyAppt() {
        return {
            duration: 20,
            addons: {},
            genderOptOut: false,
            date: null,
            selectedSlot: null,
            calendarMonth: null,  // Date for current calendar view
            milestone: null
        };
    }

    /* ── Init ──────────────────────────────────────────── */
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        var wrap = document.getElementById('ev-booking');
        if (!wrap) return;

        populateDateSelects();
        bindStep0();
        bindStep1();
        bindStep2();
        bindStep3();
        bindSidebar();
    }

    /* ═══════════════════════════════════════════════════════
       STEP 0: Pregnancy date
       ═══════════════════════════════════════════════════════ */
    function populateDateSelects() {
        var daySelect = document.getElementById('ev-day');
        var monthSelect = document.getElementById('ev-month');
        if (!daySelect || !monthSelect) return;

        for (var d = 1; d <= 31; d++) {
            var opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            daySelect.appendChild(opt);
        }

        for (var m = 0; m < 12; m++) {
            var opt2 = document.createElement('option');
            opt2.value = m + 1;
            opt2.textContent = MONTHS_NL[m];
            monthSelect.appendChild(opt2);
        }
    }

    function bindStep0() {
        // Toggle buttons
        var toggleBtns = document.querySelectorAll('.ev-toggle-btn');
        toggleBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                toggleBtns.forEach(function (b) { b.classList.remove('ev-toggle-btn--active'); });
                btn.classList.add('ev-toggle-btn--active');
                state.pregType = btn.getAttribute('data-type');
                onDateChange();
            });
        });

        // Date selects
        var daySelect = document.getElementById('ev-day');
        var monthSelect = document.getElementById('ev-month');
        if (daySelect) daySelect.addEventListener('change', function () { state.pregDay = this.value; onDateChange(); });
        if (monthSelect) monthSelect.addEventListener('change', function () { state.pregMonth = this.value; onDateChange(); });

        // Skip
        var skipBtn = document.getElementById('ev-skip-pregnancy');
        if (skipBtn) skipBtn.addEventListener('click', function () {
            state.pregnancyWeek = null;
            state.dueDate = null;
            setStep(1);
        });

        // Next
        var nextBtn = document.getElementById('ev-next-0');
        if (nextBtn) nextBtn.addEventListener('click', function () { setStep(1); });
    }

    function onDateChange() {
        if (!state.pregDay || !state.pregMonth) return;

        var day = parseInt(state.pregDay, 10);
        var month = parseInt(state.pregMonth, 10);
        var now = new Date();
        var year = now.getFullYear();

        // Build date
        var d = new Date(year, month - 1, day);

        // If date is more than 2 weeks in the past, assume next year
        var twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        if (d < twoWeeksAgo) {
            d = new Date(year + 1, month - 1, day);
        }

        if (state.pregType === 'due') {
            state.dueDate = d;
            // Calculate LMP: due date - 280 days
            var lmp = new Date(d);
            lmp.setDate(lmp.getDate() - 280);
            state.pregDate = lmp;
        } else {
            state.pregDate = d;
            // Calculate due date: LMP + 280 days
            var due = new Date(d);
            due.setDate(due.getDate() + 280);
            state.dueDate = due;
        }

        // Calculate pregnancy week
        var diffMs = now.getTime() - state.pregDate.getTime();
        var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        state.pregnancyWeek = Math.max(0, Math.floor(diffDays / 7));

        updatePregnancyUI();

        // Enable next button
        var nextBtn = document.getElementById('ev-next-0');
        if (nextBtn) nextBtn.disabled = false;
    }

    function updatePregnancyUI() {
        var info = document.getElementById('ev-preg-info');
        if (!info) return;

        info.style.display = '';

        var weekBadge = info.querySelector('.ev-preg-badge__week');
        if (weekBadge) weekBadge.textContent = state.pregnancyWeek;

        // Progress bar (40 weeks total)
        var pct = Math.min(100, (state.pregnancyWeek / 40) * 100);
        var progress = info.querySelector('.ev-timeline__progress');
        if (progress) progress.style.width = pct + '%';
    }

    /* ═══════════════════════════════════════════════════════
       STEP 1: Choose echo
       ═══════════════════════════════════════════════════════ */
    function bindStep1() {
        var backBtn = document.getElementById('ev-back-1');
        if (backBtn) backBtn.addEventListener('click', function () { setStep(0); });

        var nextBtn = document.getElementById('ev-next-1');
        if (nextBtn) nextBtn.addEventListener('click', function () { setStep(2); });

        var customBtn = document.getElementById('ev-custom-btn');
        if (customBtn) customBtn.addEventListener('click', function () {
            state.selectedSuggestion = 'custom';
            clearSuggestionSelection();
            showCustomBuilder();
            updateStep1NextButton();
        });

        // Package quantity buttons
        var pkgBtns = document.querySelectorAll('.ev-pkg-btn');
        pkgBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                pkgBtns.forEach(function (b) { b.classList.remove('ev-pkg-btn--active'); });
                btn.classList.add('ev-pkg-btn--active');
                var qty = parseInt(btn.getAttribute('data-qty'), 10);
                setPackageQty(qty);
            });
        });
    }

    function renderStep1() {
        var intro = document.getElementById('ev-suggestion-intro');
        var container = document.getElementById('ev-suggestions');
        if (!container) return;

        container.innerHTML = '';

        if (state.pregnancyWeek === null) {
            if (intro) intro.textContent = 'Stel je eigen echo samen of kies een suggestie.';
            return;
        }

        var week = state.pregnancyWeek;
        if (intro) intro.textContent = 'Op basis van je zwangerschapsweek (' + week + ' weken) raden we het volgende aan:';

        var suggestions = buildSuggestions(week);
        if (suggestions.length === 0) {
            container.innerHTML = '<p class="ev-subtitle">Er zijn geen standaardsuggesties beschikbaar voor jouw zwangerschapsduur. Stel zelf je echo samen!</p>';
            return;
        }

        suggestions.forEach(function (sug, idx) {
            var card = document.createElement('div');
            card.className = 'ev-suggestion';
            card.setAttribute('data-suggestion-idx', idx);

            var header = '<div class="ev-suggestion__header">';
            header += '<span class="ev-suggestion__title">' + sug.title + '</span>';
            header += '<span>';
            if (sug.discountPct > 0) {
                header += '<span class="ev-suggestion__price--old">' + euro(sug.originalPrice) + '</span>';
            }
            header += '<span class="ev-suggestion__price">' + euro(sug.price) + '</span>';
            header += '</span></div>';

            var desc = '<div class="ev-suggestion__desc">' + sug.desc + '</div>';

            var items = '<div class="ev-suggestion__items">';
            sug.tags.forEach(function (tag) {
                items += '<span class="ev-suggestion__item">' + tag + '</span>';
            });
            items += '</div>';

            card.innerHTML = header + desc + items;

            card.addEventListener('click', function () {
                selectSuggestion(idx, suggestions);
            });

            container.appendChild(card);
        });
    }

    function buildSuggestions(week) {
        var suggestions = [];

        // Find which milestones are still reachable
        var reachable = MILESTONES.filter(function (m) {
            return week <= m.weekEnd;
        });

        if (reachable.length === 0) return suggestions;

        if (week <= 15) {
            // Offer 1, 2, or 3 echos
            if (reachable.length >= 1) {
                suggestions.push(buildSuggestionSingle(reachable[0]));
            }
            if (reachable.length >= 2) {
                suggestions.push(buildSuggestionPackage(reachable.slice(0, 2), 2));
            }
            if (reachable.length >= 3) {
                suggestions.push(buildSuggestionPackage(reachable.slice(0, 3), 3));
            }
        } else if (week <= 29) {
            // Filter to milestones still reachable
            var futureMs = reachable.filter(function (m) { return week <= m.weekEnd; });
            if (futureMs.length >= 1) {
                suggestions.push(buildSuggestionSingle(futureMs[0]));
            }
            if (futureMs.length >= 2) {
                suggestions.push(buildSuggestionPackage(futureMs.slice(0, 2), 2));
            }
        } else {
            // >29 weeks, suggest single
            if (reachable.length >= 1) {
                suggestions.push(buildSuggestionSingle(reachable[0]));
            }
        }

        return suggestions;
    }

    function buildSuggestionSingle(milestone) {
        var dur = milestone.duration;
        var rules = getContentRules(dur);
        var price = calcBasePrice(dur);
        var tags = buildContentTags(rules);

        return {
            title: milestone.name,
            desc: milestone.desc + ' \u2022 ' + dur + ' minuten \u2022 week ' + milestone.weekStart + '-' + milestone.weekEnd,
            price: price,
            originalPrice: price,
            discountPct: 0,
            qty: 1,
            milestones: [milestone],
            durations: [dur],
            tags: tags
        };
    }

    function buildSuggestionPackage(milestones, qty) {
        var totalPrice = 0;
        var durations = [];
        var allTags = [];
        var title = 'Pakket ' + qty + " echo's";
        var descParts = [];

        milestones.forEach(function (m) {
            var dur = m.duration;
            durations.push(dur);
            totalPrice += calcBasePrice(dur);
            descParts.push(m.name + ' (week ' + m.weekIdeal + ')');
        });

        var discount = qty === 3 ? 0.20 : (qty === 2 ? 0.10 : 0);
        var discountedPrice = Math.round(totalPrice * (1 - discount) * 100) / 100;

        allTags.push(qty + " echo's");
        allTags.push(Math.round(discount * 100) + '% korting');
        milestones.forEach(function (m) { allTags.push(m.name); });

        return {
            title: title,
            desc: descParts.join(' + '),
            price: discountedPrice,
            originalPrice: totalPrice,
            discountPct: discount,
            qty: qty,
            milestones: milestones,
            durations: durations,
            tags: allTags
        };
    }

    function selectSuggestion(idx, suggestions) {
        state.selectedSuggestion = idx;
        var sug = suggestions[idx];

        // Highlight card
        var cards = document.querySelectorAll('.ev-suggestion');
        cards.forEach(function (c) { c.classList.remove('ev-suggestion--selected'); });
        cards[idx].classList.add('ev-suggestion--selected');

        // Set appointments
        state.packageQty = sug.qty;
        state.appointments = [];
        for (var i = 0; i < sug.qty; i++) {
            var appt = createEmptyAppt();
            appt.duration = sug.durations[i] || sug.durations[0];
            appt.milestone = sug.milestones[i] || null;
            state.appointments.push(appt);
        }

        // Hide custom builder
        var builder = document.getElementById('ev-custom-builder');
        if (builder) builder.style.display = 'none';

        updateStep1NextButton();
        updateSidebar();
    }

    function clearSuggestionSelection() {
        var cards = document.querySelectorAll('.ev-suggestion');
        cards.forEach(function (c) { c.classList.remove('ev-suggestion--selected'); });
    }

    function showCustomBuilder() {
        var builder = document.getElementById('ev-custom-builder');
        var pkgSelector = document.getElementById('ev-package-selector');
        if (builder) builder.style.display = '';
        if (pkgSelector) pkgSelector.style.display = '';
        renderAppointmentConfigs();
        updateSidebar();
    }

    function setPackageQty(qty) {
        state.packageQty = qty;
        while (state.appointments.length < qty) {
            state.appointments.push(createEmptyAppt());
        }
        while (state.appointments.length > qty) {
            state.appointments.pop();
        }
        renderAppointmentConfigs();
        updateStep1NextButton();
        updateSidebar();
    }

    function renderAppointmentConfigs() {
        var container = document.getElementById('ev-appointments-config');
        if (!container) return;
        container.innerHTML = '';

        state.appointments.forEach(function (appt, idx) {
            container.appendChild(createApptConfigCard(appt, idx));
        });
    }

    function createApptConfigCard(appt, idx) {
        var card = document.createElement('div');
        card.className = 'ev-appt-card';

        var title = state.packageQty > 1 ? 'Echo ' + (idx + 1) : 'Jouw echo';
        card.innerHTML = '<div class="ev-appt-card__title">' + title + '</div>';

        // Duration slider
        var durWrap = document.createElement('div');
        durWrap.className = 'ev-duration-wrap';
        durWrap.innerHTML = '<label>Duur</label><div class="ev-duration-display">' + appt.duration + ' minuten</div>';

        var slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'ev-slider';
        slider.min = 10;
        slider.max = 60;
        slider.step = 10;
        slider.value = appt.duration;

        var ticks = document.createElement('div');
        ticks.className = 'ev-duration-ticks';
        DURATIONS.forEach(function (d) {
            var sp = document.createElement('span');
            sp.textContent = d + "'";
            ticks.appendChild(sp);
        });

        slider.addEventListener('input', function () {
            var val = parseInt(this.value, 10);
            appt.duration = val;
            durWrap.querySelector('.ev-duration-display').textContent = val + ' minuten';
            renderContentGrid(contentGrid, val);
            renderAddons(addonsEl, appt, idx);
            updateSidebar();
        });

        durWrap.appendChild(slider);
        durWrap.appendChild(ticks);
        card.appendChild(durWrap);

        // Content grid
        var contentGrid = document.createElement('div');
        contentGrid.className = 'ev-content-grid';
        renderContentGrid(contentGrid, appt.duration);
        card.appendChild(contentGrid);

        // Addons
        var addonsEl = document.createElement('div');
        addonsEl.className = 'ev-addons';
        renderAddons(addonsEl, appt, idx);
        card.appendChild(addonsEl);

        return card;
    }

    function renderContentGrid(container, duration) {
        var rules = getContentRules(duration);
        container.innerHTML = '';

        var items = [
            { label: rules.photos_2d + 'x 2D beelden', included: rules.photos_2d > 0 },
            { label: rules.photos_3d > 0 ? rules.photos_3d + 'x 3D beelden' : '3D beelden', included: rules.photos_3d > 0 },
            { label: rules.videos_2d > 0 ? rules.videos_2d + 'x 2D video' : '2D video', included: rules.videos_2d > 0 },
            { label: rules.videos_4d > 0 ? rules.videos_4d + 'x 4D video' : '4D video', included: rules.videos_4d > 0 },
            { label: rules.prints_a4 > 0 ? rules.prints_a4 + 'x A4 afdruk' : 'A4 afdruk', included: rules.prints_a4 > 0 },
            { label: rules.prints_10x15 > 0 ? rules.prints_10x15 + 'x 10\u00d715 afdruk' : '10\u00d715 afdruk', included: rules.prints_10x15 > 0 },
            { label: 'USB-stick', included: rules.usb_free },
            { label: 'Volledige opname', included: rules.recording_free },
            { label: 'Geslachtsbepaling', included: true }
        ];

        items.forEach(function (item) {
            var el = document.createElement('div');
            el.className = 'ev-content-item ' + (item.included ? 'ev-content-item--included' : 'ev-content-item--not-included');
            el.innerHTML = '<span class="ev-content-item__icon">' + (item.included ? '\u2713' : '\u2013') + '</span>' +
                '<span>' + item.label + '</span>';
            container.appendChild(el);
        });
    }

    function renderAddons(container, appt, idx) {
        container.innerHTML = '<div class="ev-addons__title">Extra opties</div>';
        var rules = getContentRules(appt.duration);

        // 3D photos (only if not included)
        if (rules.photos_3d === 0) {
            container.appendChild(createAddonToggle(
                'add_3d', '3D beelden toevoegen', PRICING.price3dExtra, appt, idx
            ));
        }

        // USB stick (only if not free)
        if (!rules.usb_free) {
            container.appendChild(createAddonToggle(
                'add_usb', 'USB-stick (16 GB)', PRICING.priceUsb, appt, idx
            ));
        }

        // Recording (only if not free)
        if (!rules.recording_free) {
            var recRow = createAddonToggle(
                'add_recording', 'Volledige opname', PRICING.priceRecording, appt, idx, true
            );
            container.appendChild(recRow);
            // Note about USB requirement
            if (!rules.usb_free) {
                var note = document.createElement('div');
                note.className = 'ev-addon-note';
                note.textContent = 'Vereist USB-stick';
                container.appendChild(note);
            }
        }

        // Extra A4 prints
        container.appendChild(createAddonQty(
            'extra_a4', 'Extra A4 afdrukken', PRICING.priceExtraA4,
            rules.prints_a4 > 0 ? rules.prints_a4 + ' inbegrepen' : '',
            appt, idx
        ));

        // Extra 10x15 prints
        container.appendChild(createAddonQty(
            'extra_10x15', 'Extra 10\u00d715 afdrukken', PRICING.priceExtra10x15,
            rules.prints_10x15 > 0 ? rules.prints_10x15 + ' inbegrepen' : '',
            appt, idx
        ));

        // Gender opt-out
        var genderRow = document.createElement('div');
        genderRow.className = 'ev-addon-row';
        var genderLabel = document.createElement('label');
        var genderCb = document.createElement('input');
        genderCb.type = 'checkbox';
        genderCb.checked = !appt.genderOptOut;
        genderCb.addEventListener('change', function () {
            appt.genderOptOut = !this.checked;
            updateSidebar();
        });
        genderLabel.appendChild(genderCb);
        genderLabel.appendChild(document.createTextNode(' Geslachtsbepaling'));
        genderRow.appendChild(genderLabel);
        var genderPrice = document.createElement('span');
        genderPrice.className = 'ev-addon-price ev-addon-price--free';
        genderPrice.textContent = 'Gratis';
        genderRow.appendChild(genderPrice);
        container.appendChild(genderRow);
    }

    function createAddonToggle(key, label, price, appt, idx, requiresUsb) {
        var row = document.createElement('div');
        row.className = 'ev-addon-row';

        var lbl = document.createElement('label');
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!appt.addons[key];
        cb.addEventListener('change', function () {
            appt.addons[key] = this.checked;

            // If recording requires USB, auto-select USB
            if (key === 'add_recording' && this.checked) {
                appt.addons['add_usb'] = true;
                renderAppointmentConfigs();
            }
            // If USB unchecked, uncheck recording
            if (key === 'add_usb' && !this.checked && appt.addons['add_recording']) {
                appt.addons['add_recording'] = false;
                renderAppointmentConfigs();
            }

            updateSidebar();
        });
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(' ' + label));
        row.appendChild(lbl);

        var priceEl = document.createElement('span');
        priceEl.className = 'ev-addon-price';
        priceEl.textContent = '+ ' + euro(price);
        row.appendChild(priceEl);

        return row;
    }

    function createAddonQty(key, label, unitPrice, freeText, appt, idx) {
        var row = document.createElement('div');
        row.className = 'ev-addon-row';

        var lbl = document.createElement('span');
        lbl.style.fontSize = '.88rem';
        lbl.style.fontWeight = '600';
        var text = label;
        if (freeText) text += ' <small style="color:var(--ev-text-muted);">(' + freeText + ')</small>';
        lbl.innerHTML = text;
        row.appendChild(lbl);

        var right = document.createElement('div');
        right.style.display = 'flex';
        right.style.alignItems = 'center';
        right.style.gap = '.6rem';

        var qty = parseInt(appt.addons[key] || 0, 10);

        var control = document.createElement('div');
        control.className = 'ev-qty-control';

        var minusBtn = document.createElement('button');
        minusBtn.type = 'button';
        minusBtn.className = 'ev-qty-btn';
        minusBtn.textContent = '\u2013';

        var valInput = document.createElement('input');
        valInput.type = 'text';
        valInput.className = 'ev-qty-value';
        valInput.value = qty;
        valInput.readOnly = true;

        var plusBtn = document.createElement('button');
        plusBtn.type = 'button';
        plusBtn.className = 'ev-qty-btn';
        plusBtn.textContent = '+';

        minusBtn.addEventListener('click', function () {
            var v = parseInt(valInput.value, 10);
            if (v > 0) {
                v--;
                valInput.value = v;
                appt.addons[key] = v;
                priceEl.textContent = v > 0 ? '+ ' + euro(v * unitPrice) : euro(0);
                updateSidebar();
            }
        });

        plusBtn.addEventListener('click', function () {
            var v = parseInt(valInput.value, 10);
            if (v < 20) {
                v++;
                valInput.value = v;
                appt.addons[key] = v;
                priceEl.textContent = '+ ' + euro(v * unitPrice);
                updateSidebar();
            }
        });

        control.appendChild(minusBtn);
        control.appendChild(valInput);
        control.appendChild(plusBtn);

        var priceEl = document.createElement('span');
        priceEl.className = 'ev-addon-price';
        priceEl.textContent = qty > 0 ? '+ ' + euro(qty * unitPrice) : euro(0);
        priceEl.style.minWidth = '60px';
        priceEl.style.textAlign = 'right';

        right.appendChild(control);
        right.appendChild(priceEl);
        row.appendChild(right);

        return row;
    }

    function updateStep1NextButton() {
        var btn = document.getElementById('ev-next-1');
        if (!btn) return;

        var configured = state.selectedSuggestion !== null;
        if (state.selectedSuggestion === 'custom') {
            configured = state.appointments.length > 0 && state.appointments.every(function (a) {
                return a.duration >= 10;
            });
        }
        btn.disabled = !configured;
    }

    /* ═══════════════════════════════════════════════════════
       STEP 2: Date & Time
       ═══════════════════════════════════════════════════════ */
    function bindStep2() {
        var backBtn = document.getElementById('ev-back-2');
        if (backBtn) backBtn.addEventListener('click', function () { setStep(1); });

        var nextBtn = document.getElementById('ev-next-2');
        if (nextBtn) nextBtn.addEventListener('click', function () { setStep(3); });
    }

    function renderStep2() {
        var container = document.getElementById('ev-datetime-panels');
        if (!container) return;
        container.innerHTML = '';

        state.appointments.forEach(function (appt, idx) {
            var card = document.createElement('div');
            card.className = 'ev-datetime-card';

            var title = state.packageQty > 1
                ? 'Echo ' + (idx + 1) + (appt.milestone ? ' \u2013 ' + appt.milestone.name : '')
                : 'Jouw echo' + (appt.milestone ? ' \u2013 ' + appt.milestone.name : '');

            card.innerHTML = '<div class="ev-datetime-card__title">' + title + ' (' + appt.duration + ' min)</div>';

            // Calendar
            var calEl = document.createElement('div');
            calEl.className = 'ev-calendar';
            renderCalendar(calEl, appt, idx);
            card.appendChild(calEl);

            // Timeslots container
            var slotsEl = document.createElement('div');
            slotsEl.className = 'ev-timeslots';
            slotsEl.id = 'ev-timeslots-' + idx;
            card.appendChild(slotsEl);

            container.appendChild(card);

            // If date already selected, load slots
            if (appt.date) {
                loadSlots(idx);
            }
        });
    }

    function renderCalendar(container, appt, apptIdx) {
        var now = new Date();
        var viewDate = appt.calendarMonth || (appt.milestone ? getIdealDate(appt.milestone) : new Date(now.getFullYear(), now.getMonth(), 1));
        appt.calendarMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);

        var year = viewDate.getFullYear();
        var month = viewDate.getMonth();

        container.innerHTML = '';

        // Header
        var header = document.createElement('div');
        header.className = 'ev-calendar__header';

        var prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'ev-calendar__nav';
        prevBtn.innerHTML = '&lsaquo;';
        prevBtn.addEventListener('click', function () {
            appt.calendarMonth = new Date(year, month - 1, 1);
            renderCalendar(container, appt, apptIdx);
        });

        var monthLabel = document.createElement('span');
        monthLabel.className = 'ev-calendar__month';
        monthLabel.textContent = MONTHS_NL[month] + ' ' + year;

        var nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'ev-calendar__nav';
        nextBtn.innerHTML = '&rsaquo;';
        nextBtn.addEventListener('click', function () {
            appt.calendarMonth = new Date(year, month + 1, 1);
            renderCalendar(container, appt, apptIdx);
        });

        header.appendChild(prevBtn);
        header.appendChild(monthLabel);
        header.appendChild(nextBtn);
        container.appendChild(header);

        // Grid
        var grid = document.createElement('div');
        grid.className = 'ev-calendar__grid';

        // Day of week headers
        DAYS_NL.forEach(function (d) {
            var dow = document.createElement('span');
            dow.className = 'ev-calendar__dow';
            dow.textContent = d;
            grid.appendChild(dow);
        });

        // Days
        var firstDay = new Date(year, month, 1).getDay(); // 0=Sun
        var startOffset = firstDay === 0 ? 6 : firstDay - 1; // Monday-based
        var daysInMonth = new Date(year, month + 1, 0).getDate();

        var today = new Date();
        today.setHours(0, 0, 0, 0);

        // Optimal range for milestone highlighting
        var optStart = null, optEnd = null;
        if (appt.milestone && state.dueDate) {
            optStart = getWeekDate(appt.milestone.weekStart);
            optEnd = getWeekDate(appt.milestone.weekEnd);
        }

        // Empty cells
        for (var e = 0; e < startOffset; e++) {
            var empty = document.createElement('span');
            empty.className = 'ev-calendar__day ev-calendar__day--empty';
            grid.appendChild(empty);
        }

        for (var d = 1; d <= daysInMonth; d++) {
            var dayDate = new Date(year, month, d);
            var dayEl = document.createElement('button');
            dayEl.type = 'button';
            dayEl.className = 'ev-calendar__day';
            dayEl.textContent = d;

            if (dayDate < today) {
                dayEl.classList.add('ev-calendar__day--disabled');
            } else {
                // Today
                if (dayDate.getTime() === today.getTime()) {
                    dayEl.classList.add('ev-calendar__day--today');
                }

                // Optimal range
                if (optStart && optEnd && dayDate >= optStart && dayDate <= optEnd) {
                    dayEl.classList.add('ev-calendar__day--optimal');
                }

                // Selected
                if (appt.date && dayDate.toDateString() === appt.date.toDateString()) {
                    dayEl.classList.add('ev-calendar__day--selected');
                }

                (function (dd) {
                    dayEl.addEventListener('click', function () {
                        appt.date = dd;
                        appt.selectedSlot = null;
                        renderCalendar(container, appt, apptIdx);
                        loadSlots(apptIdx);
                        updateStep2NextButton();
                        updateSidebar();
                    });
                })(dayDate);
            }

            grid.appendChild(dayEl);
        }

        container.appendChild(grid);
    }

    function getIdealDate(milestone) {
        if (!state.pregDate) return new Date();
        var d = new Date(state.pregDate);
        d.setDate(d.getDate() + milestone.weekIdeal * 7);
        return d;
    }

    function getWeekDate(week) {
        if (!state.pregDate) return null;
        var d = new Date(state.pregDate);
        d.setDate(d.getDate() + week * 7);
        return d;
    }

    function loadSlots(apptIdx) {
        var appt = state.appointments[apptIdx];
        if (!appt.date) return;

        var slotsEl = document.getElementById('ev-timeslots-' + apptIdx);
        if (!slotsEl) return;

        slotsEl.innerHTML = '<div class="ev-spinner"></div>';
        state.slotsLoading[apptIdx] = true;

        var serviceId = SERVICES[appt.duration] || 0;
        if (!serviceId) {
            slotsEl.innerHTML = '<div class="ev-error">Geen service geconfigureerd voor ' + appt.duration + ' minuten.</div>';
            return;
        }

        var dateStr = formatDateISO(appt.date);

        var formData = new FormData();
        formData.append('action', 'echovisie_get_slots');
        formData.append('nonce', CFG.nonce);
        formData.append('service_id', serviceId);
        formData.append('date', dateStr);
        formData.append('duration', appt.duration);

        fetch(CFG.ajaxUrl, { method: 'POST', body: formData })
            .then(function (r) { return r.json(); })
            .then(function (resp) {
                state.slotsLoading[apptIdx] = false;
                if (resp.success) {
                    state.slotsData[apptIdx] = resp.data;
                    renderTimeslots(slotsEl, resp.data, appt, apptIdx);
                } else {
                    slotsEl.innerHTML = '<div class="ev-error">' + (resp.data && resp.data.message || 'Er ging iets mis.') + '</div>';
                }
            })
            .catch(function () {
                state.slotsLoading[apptIdx] = false;
                slotsEl.innerHTML = '<div class="ev-error">Kon geen verbinding maken. Probeer het opnieuw.</div>';
            });
    }

    function renderTimeslots(container, data, appt, apptIdx) {
        container.innerHTML = '';

        var slots = data.slots || [];

        if (slots.length === 0) {
            var noSlots = document.createElement('div');
            noSlots.className = 'ev-no-slots';
            noSlots.innerHTML = '<p>Geen beschikbare tijdsloten op deze dag.</p>';

            var nearby = data.nearby || {};
            if (nearby.prev || nearby.next) {
                var actions = document.createElement('div');
                actions.className = 'ev-no-slots__actions';

                if (nearby.prev) {
                    var prevBtn = document.createElement('button');
                    prevBtn.type = 'button';
                    prevBtn.className = 'ev-btn ev-btn--outline';
                    prevBtn.textContent = '\u2190 ' + formatDateNL(new Date(nearby.prev));
                    prevBtn.addEventListener('click', function () {
                        appt.date = new Date(nearby.prev);
                        appt.calendarMonth = new Date(appt.date.getFullYear(), appt.date.getMonth(), 1);
                        // Re-render entire step2 panel for this appointment
                        renderStep2();
                    });
                    actions.appendChild(prevBtn);
                }

                if (nearby.next) {
                    var nextBtn = document.createElement('button');
                    nextBtn.type = 'button';
                    nextBtn.className = 'ev-btn ev-btn--outline';
                    nextBtn.textContent = formatDateNL(new Date(nearby.next)) + ' \u2192';
                    nextBtn.addEventListener('click', function () {
                        appt.date = new Date(nearby.next);
                        appt.calendarMonth = new Date(appt.date.getFullYear(), appt.date.getMonth(), 1);
                        renderStep2();
                    });
                    actions.appendChild(nextBtn);
                }

                noSlots.appendChild(actions);
            }

            container.appendChild(noSlots);
            return;
        }

        // Label
        var label = document.createElement('div');
        label.className = 'ev-timeslots__label';
        label.textContent = 'Beschikbare tijden';
        container.appendChild(label);

        // Grid
        var grid = document.createElement('div');
        grid.className = 'ev-timeslots__grid';

        slots.forEach(function (slot) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ev-timeslot';

            if (!slot.is_peak) {
                btn.classList.add('ev-timeslot--cheap');
            }

            if (appt.selectedSlot && appt.selectedSlot.time === slot.time && appt.selectedSlot.staff_id === slot.staff_id) {
                btn.classList.add('ev-timeslot--selected');
            }

            btn.innerHTML = slot.time + '<span class="ev-timeslot__staff">' + slot.staff_name + '</span>';

            btn.addEventListener('click', function () {
                appt.selectedSlot = slot;
                // Re-render slots to update selection
                renderTimeslots(container, data, appt, apptIdx);
                updateStep2NextButton();
                updateSidebar();
            });

            grid.appendChild(btn);
        });

        container.appendChild(grid);

        // Legend
        var legend = document.createElement('div');
        legend.className = 'ev-timeslot-legend';
        legend.innerHTML = '<span><span class="ev-timeslot-legend__dot ev-timeslot-legend__dot--cheap"></span>Voordelig (dagtarief)</span>' +
            '<span><span class="ev-timeslot-legend__dot ev-timeslot-legend__dot--peak"></span>Avond/weekend (+ ' + euro(PRICING.surchargeAmount) + ')</span>';
        container.appendChild(legend);
    }

    function updateStep2NextButton() {
        var btn = document.getElementById('ev-next-2');
        if (!btn) return;

        var allSelected = state.appointments.every(function (a) {
            return a.date && a.selectedSlot;
        });
        btn.disabled = !allSelected;
    }

    /* ═══════════════════════════════════════════════════════
       STEP 3: Customer details
       ═══════════════════════════════════════════════════════ */
    function bindStep3() {
        var backBtn = document.getElementById('ev-back-3');
        if (backBtn) backBtn.addEventListener('click', function () { setStep(2); });

        var submitBtn = document.getElementById('ev-submit');
        if (submitBtn) submitBtn.addEventListener('click', handleSubmit);
    }

    function handleSubmit() {
        if (state.bookingInProgress) return;

        var fname = document.getElementById('ev-fname');
        var lname = document.getElementById('ev-lname');
        var email = document.getElementById('ev-email');
        var phone = document.getElementById('ev-phone');
        var notes = document.getElementById('ev-notes');

        if (!fname.value.trim() || !email.value.trim() || !phone.value.trim()) {
            showError('Vul alle verplichte velden in.');
            return;
        }

        // Basic email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
            showError('Vul een geldig e-mailadres in.');
            return;
        }

        state.bookingInProgress = true;
        var submitBtn = document.getElementById('ev-submit');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Bezig met boeken...';
        }

        var appointmentsData = state.appointments.map(function (appt) {
            return {
                duration: appt.duration,
                date: formatDateISO(appt.date),
                time: appt.selectedSlot.time,
                staff_id: appt.selectedSlot.staff_id,
                service_id: SERVICES[appt.duration] || 0,
                addons: appt.addons,
                gender_opt_out: appt.genderOptOut
            };
        });

        var payload = {
            appointments: appointmentsData,
            customer: {
                first_name: fname.value.trim(),
                last_name: (lname && lname.value.trim()) || '',
                email: email.value.trim(),
                phone: phone.value.trim(),
                notes: (notes && notes.value.trim()) || ''
            },
            pregnancy: {
                type: state.pregType,
                date: state.dueDate ? formatDateISO(state.dueDate) : '',
                week: state.pregnancyWeek || 0
            }
        };

        var formData = new FormData();
        formData.append('action', 'echovisie_book');
        formData.append('nonce', CFG.nonce);
        formData.append('data', JSON.stringify(payload));

        fetch(CFG.ajaxUrl, { method: 'POST', body: formData })
            .then(function (r) { return r.json(); })
            .then(function (resp) {
                state.bookingInProgress = false;
                if (resp.success) {
                    showSuccess(resp.data);
                } else {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Afspraak bevestigen';
                    }
                    showError(resp.data && resp.data.message || 'Er ging iets mis bij het boeken.');
                }
            })
            .catch(function () {
                state.bookingInProgress = false;
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Afspraak bevestigen';
                }
                showError('Kon geen verbinding maken met de server.');
            });
    }

    function showError(msg) {
        // Remove existing error
        var existing = document.querySelector('.ev-error');
        if (existing) existing.remove();

        var panel = document.querySelector('.ev-panel[data-panel="' + state.currentStep + '"]');
        if (!panel) return;

        var el = document.createElement('div');
        el.className = 'ev-error';
        el.textContent = msg;
        panel.insertBefore(el, panel.firstChild.nextSibling);

        // Auto-remove after 5 seconds
        setTimeout(function () { if (el.parentNode) el.remove(); }, 5000);
    }

    function showSuccess(data) {
        // Hide all panels
        var panels = document.querySelectorAll('.ev-panel');
        panels.forEach(function (p) { p.style.display = 'none'; });

        var successPanel = document.querySelector('[data-panel="success"]');
        if (successPanel) {
            successPanel.style.display = '';

            var details = document.getElementById('ev-confirmation-details');
            if (details && data.appointments) {
                var html = '<div class="ev-confirmation">';
                data.appointments.forEach(function (appt, idx) {
                    html += '<div class="ev-confirmation__item"><span class="ev-confirmation__label">' +
                        (data.appointments.length > 1 ? 'Echo ' + (idx + 1) : 'Datum') +
                        '</span><span class="ev-confirmation__value">' + appt.date + ' om ' + appt.time + '</span></div>';
                    html += '<div class="ev-confirmation__item"><span class="ev-confirmation__label">Medewerker</span><span class="ev-confirmation__value">' + appt.staff + '</span></div>';
                });
                if (data.total !== undefined) {
                    html += '<div class="ev-confirmation__item"><span class="ev-confirmation__label">Totaalprijs</span><span class="ev-confirmation__value ev-price">' + euro(data.total) + '</span></div>';
                }
                html += '</div>';
                details.innerHTML = html;
            }
        }

        // Hide sidebar
        var sidebar = document.getElementById('ev-sidebar');
        if (sidebar) sidebar.style.display = 'none';

        // Update step bar to all done
        var steps = document.querySelectorAll('.ev-step');
        steps.forEach(function (s) {
            s.classList.remove('ev-step--active');
            s.classList.add('ev-step--done');
        });
    }

    /* ═══════════════════════════════════════════════════════
       Step navigation
       ═══════════════════════════════════════════════════════ */
    function setStep(n) {
        state.currentStep = n;

        // Show/hide panels
        var panels = document.querySelectorAll('.ev-panel');
        panels.forEach(function (p) {
            var panelIdx = p.getAttribute('data-panel');
            p.style.display = panelIdx == n ? '' : 'none';
        });

        // Update step bar
        var steps = document.querySelectorAll('.ev-step');
        steps.forEach(function (s) {
            var sIdx = parseInt(s.getAttribute('data-step'), 10);
            s.classList.remove('ev-step--active', 'ev-step--done');
            if (sIdx === n) s.classList.add('ev-step--active');
            else if (sIdx < n) s.classList.add('ev-step--done');
        });

        // Render step-specific content
        if (n === 1) {
            renderStep1();
            if (state.selectedSuggestion === 'custom') {
                showCustomBuilder();
            }
        } else if (n === 2) {
            renderStep2();
        }

        updateSidebar();

        // Scroll to top of widget
        var wrap = document.getElementById('ev-booking');
        if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ═══════════════════════════════════════════════════════
       Sidebar
       ═══════════════════════════════════════════════════════ */
    function bindSidebar() {
        // Mobile toggle
        var title = document.querySelector('.ev-sidebar__title');
        if (title) {
            title.addEventListener('click', function () {
                var sidebar = document.getElementById('ev-sidebar');
                if (sidebar && window.innerWidth <= 860) {
                    sidebar.classList.toggle('ev-sidebar--expanded');
                }
            });
        }
    }

    function updateSidebar() {
        var content = document.getElementById('ev-sidebar-content');
        var totalEl = document.getElementById('ev-sidebar-total');
        var priceEl = document.getElementById('ev-total-price');
        if (!content) return;

        if (state.appointments.length === 0 || state.selectedSuggestion === null) {
            content.innerHTML = '<p class="ev-sidebar__empty">Stel je echo samen om de prijs te zien.</p>';
            if (totalEl) totalEl.style.display = 'none';
            return;
        }

        var html = '';
        var subtotal = 0;

        state.appointments.forEach(function (appt, idx) {
            var rules = getContentRules(appt.duration);
            var base = calcBasePrice(appt.duration);
            var addonTotal = calcAddonTotal(appt);
            var surcharge = 0;
            if (appt.selectedSlot && appt.selectedSlot.is_peak) {
                surcharge = PRICING.surchargeAmount || 0;
            }
            var apptTotal = base + addonTotal + surcharge;
            subtotal += apptTotal;

            html += '<div class="ev-sidebar__appt">';
            html += '<div class="ev-sidebar__appt-title">' +
                (state.packageQty > 1 ? 'Echo ' + (idx + 1) : 'Jouw echo') +
                ' \u2013 ' + appt.duration + ' min</div>';

            var details = [];
            if (rules.photos_2d > 0) details.push(rules.photos_2d + 'x 2D');
            if (rules.photos_3d > 0 || appt.addons.add_3d) details.push((rules.photos_3d || '?') + 'x 3D');
            if (rules.videos_4d > 0) details.push(rules.videos_4d + 'x 4D video');
            if (!appt.genderOptOut) details.push('Geslachtsbepaling');
            if (rules.usb_free || appt.addons.add_usb) details.push('USB-stick');
            if (rules.recording_free || appt.addons.add_recording) details.push('Opname');

            if (appt.date) {
                details.push(formatDateNL(appt.date));
            }
            if (appt.selectedSlot) {
                details.push(appt.selectedSlot.time + ' - ' + appt.selectedSlot.staff_name);
            }

            html += '<div class="ev-sidebar__appt-detail">' + details.join(' \u2022 ') + '</div>';
            html += '<div class="ev-sidebar__appt-price">' + euro(apptTotal) + '</div>';
            html += '</div>';
        });

        content.innerHTML = html;

        // Discount
        var discountPct = state.packageQty >= 3 ? 0.20 : (state.packageQty >= 2 ? 0.10 : 0);
        var discountAmt = Math.round(subtotal * discountPct * 100) / 100;
        var total = Math.round((subtotal - discountAmt) * 100) / 100;

        // Remove existing discount row
        var existingDiscount = document.querySelector('.ev-sidebar__discount');
        if (existingDiscount) existingDiscount.remove();

        if (discountPct > 0) {
            var discountRow = document.createElement('div');
            discountRow.className = 'ev-sidebar__discount';
            discountRow.innerHTML = '<span>Pakketkorting (' + Math.round(discountPct * 100) + '%)</span><span>- ' + euro(discountAmt) + '</span>';
            // Insert before total
            if (totalEl) totalEl.parentNode.insertBefore(discountRow, totalEl);
        }

        if (totalEl) totalEl.style.display = '';
        if (priceEl) priceEl.textContent = euro(total);
    }

    /* ═══════════════════════════════════════════════════════
       Pricing helpers (JS mirror of PHP)
       ═══════════════════════════════════════════════════════ */
    function getContentRules(duration) {
        var rules = CONTENT_RULES[duration];
        if (rules) return rules;
        // Fallback
        return {
            photos_2d: 0, photos_3d: 0, videos_2d: 0, videos_4d: 0,
            prints_a4: 0, prints_10x15: 0, usb_free: 0, recording_free: 0
        };
    }

    function calcBasePrice(duration) {
        return (PRICING.pricePerBlock || 15) * (duration / 10);
    }

    function calcAddonTotal(appt) {
        var rules = getContentRules(appt.duration);
        var total = 0;

        if (appt.addons.add_3d && rules.photos_3d === 0) {
            total += PRICING.price3dExtra || 0;
        }
        if (appt.addons.add_usb && !rules.usb_free) {
            total += PRICING.priceUsb || 0;
        }
        if (appt.addons.add_recording && !rules.recording_free) {
            total += PRICING.priceRecording || 0;
        }
        var extraA4 = parseInt(appt.addons.extra_a4 || 0, 10);
        if (extraA4 > 0) total += extraA4 * (PRICING.priceExtraA4 || 0);
        var extra10 = parseInt(appt.addons.extra_10x15 || 0, 10);
        if (extra10 > 0) total += extra10 * (PRICING.priceExtra10x15 || 0);

        return Math.round(total * 100) / 100;
    }

    /* ═══════════════════════════════════════════════════════
       Utility
       ═══════════════════════════════════════════════════════ */
    function euro(amount) {
        if (typeof amount !== 'number') amount = parseFloat(amount) || 0;
        return '\u20AC ' + amount.toFixed(2).replace('.', ',');
    }

    function formatDateISO(d) {
        if (!d) return '';
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    function formatDateNL(d) {
        if (!d) return '';
        if (typeof d === 'string') d = new Date(d);
        return d.getDate() + ' ' + MONTHS_NL[d.getMonth()] + ' ' + d.getFullYear();
    }

    function buildContentTags(rules) {
        var tags = [];
        if (rules.photos_2d > 0) tags.push(rules.photos_2d + 'x 2D');
        if (rules.photos_3d > 0) tags.push(rules.photos_3d + 'x 3D');
        if (rules.videos_4d > 0) tags.push(rules.videos_4d + 'x 4D video');
        if (rules.usb_free) tags.push('USB-stick');
        if (rules.recording_free) tags.push('Opname');
        tags.push('Geslachtsbepaling');
        return tags;
    }

})();
