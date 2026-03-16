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
    var DURATIONS = [10, 20, 30, 40, 50];

    var MILESTONES = [
        { id: 'gender', name: 'Geslachtsbepaling', weekStart: 15, weekEnd: 20, weekIdeal: 16, duration: 20, desc: 'Ideaal voor geslachtsbepaling' },
        { id: 'pretecho', name: 'Pretecho (3D/4D)', weekStart: 22, weekEnd: 29, weekIdeal: 28, duration: 40, desc: 'Optimaal voor 3D/4D-beelden' },
        { id: 'portrait', name: 'Portretecho', weekStart: 32, weekEnd: 36, weekIdeal: 34, duration: 30, desc: 'Gedetailleerde portretbeelden' }
    ];

    /* ── Icons (SVG strings reused in content grid and sidebar) ── */
    var IC = {
        photo2d: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.65 0-3 1.35-3 3s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3z"/></svg>',
        photo3d: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M11.99 2L2 7l10 5 10-5-10.01-5zM2 17l10 5 10-5-3.55-1.77-6.45 3.22-6.45-3.22L2 17zm0-5l10 5 10-5-3.55-1.77-6.45 3.22-6.45-3.22L2 12z"/></svg>',
        video:   '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
        film:    '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>',
        print:   '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>',
        photo:   '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
        usb:     '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M15 7v4h1v2h-3V5h2l-3-4-3 4h2v8H8v-2.07c.7-.37 1.2-1.08 1.2-1.93C9.2 7.75 8.45 7 7.5 7S5.8 7.75 5.8 8.93c0 .85.5 1.56 1.2 1.93V13c0 1.1.9 2 2 2h3v3.05c-.71.37-1.2 1.1-1.2 1.95 0 1.22.98 2.2 2.2 2.2s2.2-.98 2.2-2.2c0-.85-.49-1.58-1.2-1.95V15h3c1.1 0 2-.9 2-2v-2h1V7h-4z"/></svg>',
        mic:     '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/></svg>',
        heart:   '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'
    };

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

        voucherCode: '',
        voucher: null,          // { discount_pct, deduction, label } when validated

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
    // Safe init: handles both deferred scripts (DOMContentLoaded already fired)
    // and normal scripts (DOMContentLoaded not yet fired)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        var wrap = document.getElementById('ev-booking');
        if (!wrap) return;

        // Handle Mollie payment return before rendering the form
        if (CFG.paymentReturn) {
            handlePaymentReturn(CFG.paymentReturn);
            return;
        }

        populateDateSelects();
        bindStep0();
        bindStep1();
        bindStep2();
        bindExtrasStep();
        bindStep4();
        bindVoucher();
        bindSidebar();
    }

    var MONTHS_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

    /* ═══════════════════════════════════════════════════════
       STEP 0: Pregnancy date
       ═══════════════════════════════════════════════════════ */
    function populateDateSelects() {
        // Build month grid buttons — completely custom, immune to theme select-replacement libraries
        var grid = document.getElementById('ev-month-grid');
        if (!grid) return;

        MONTHS_SHORT.forEach(function (name, idx) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ev-month-btn';
            btn.textContent = name;
            btn.setAttribute('data-month', idx + 1);
            btn.addEventListener('click', function () {
                if (btn.disabled) return;
                // Deselect all, select this one
                grid.querySelectorAll('.ev-month-btn').forEach(function (b) {
                    b.classList.remove('ev-month-btn--selected');
                });
                btn.classList.add('ev-month-btn--selected');
                state.pregMonth = String(idx + 1);
                onDateChange();
            });
            grid.appendChild(btn);
        });

        updateMonthButtonStates();
    }

    function updateMonthButtonStates() {
        var grid = document.getElementById('ev-month-grid');
        if (!grid) return;

        var day = parseInt(state.pregDay, 10);
        if (isNaN(day) || day < 1 || day > 31) day = 1;

        var now = new Date();
        var year = now.getFullYear();

        grid.querySelectorAll('.ev-month-btn').forEach(function (btn) {
            var month = parseInt(btn.getAttribute('data-month'), 10);
            var valid = false;

            if (state.pregType === 'due') {
                // Due date: must be between 2 weeks ago and 9 months ahead
                var d = new Date(year, month - 1, day);
                var twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
                if (d < twoWeeksAgo) d = new Date(year + 1, month - 1, day);
                var nineMonthsAhead = new Date(); nineMonthsAhead.setMonth(nineMonthsAhead.getMonth() + 9);
                valid = d >= twoWeeksAgo && d <= nineMonthsAhead;
            } else {
                // LMP: must be within past 9 months (not in the future)
                var d = new Date(year, month - 1, day);
                if (d > now) d = new Date(year - 1, month - 1, day);
                var nineMonthsAgo = new Date(); nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);
                valid = d <= now && d >= nineMonthsAgo;
            }

            btn.disabled = !valid;
            if (!valid) {
                btn.classList.add('ev-month-btn--disabled');
                // Deselect if this was the active month
                if (btn.classList.contains('ev-month-btn--selected')) {
                    btn.classList.remove('ev-month-btn--selected');
                    state.pregMonth = '';
                    var nextBtn = document.getElementById('ev-next-0');
                    if (nextBtn) nextBtn.disabled = true;
                }
            } else {
                btn.classList.remove('ev-month-btn--disabled');
            }
        });
    }

    function bindStep0() {
        // Toggle buttons
        var toggleBtns = document.querySelectorAll('.ev-toggle-btn');
        toggleBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                toggleBtns.forEach(function (b) { b.classList.remove('ev-toggle-btn--active'); });
                btn.classList.add('ev-toggle-btn--active');
                state.pregType = btn.getAttribute('data-type');
                updateMonthButtonStates();
                onDateChange();
            });
        });

        // Day number input — plain <input type="number">, never replaced by theme libraries
        var dayInput = document.getElementById('ev-day-input');
        if (dayInput) {
            dayInput.addEventListener('input', function () {
                state.pregDay = this.value;
                updateMonthButtonStates();
                onDateChange();
            });
            dayInput.addEventListener('change', function () {
                state.pregDay = this.value;
                updateMonthButtonStates();
                onDateChange();
            });
        }

        // Timeline bar drag — replaces the detached range slider
        var timelineBar = document.getElementById('ev-timeline-bar');
        if (timelineBar) {
            var _dragging = false;

            function applyWeekFromX(clientX) {
                var rect = timelineBar.getBoundingClientRect();
                var pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                var week = Math.round(pct * 42);

                state.pregnancyWeek = week;

                var now = new Date();
                var lmp = new Date(now.getTime());
                lmp.setDate(lmp.getDate() - week * 7);
                state.pregDate = lmp;
                var due = new Date(lmp.getTime());
                due.setDate(due.getDate() + 280);
                state.dueDate = due;

                var nextBtn = document.getElementById('ev-next-0');
                if (nextBtn) nextBtn.disabled = false;

                updatePregnancyUI();
            }

            timelineBar.addEventListener('pointerdown', function (e) {
                _dragging = true;
                timelineBar.setPointerCapture(e.pointerId);
                applyWeekFromX(e.clientX);
                e.preventDefault();
            });
            timelineBar.addEventListener('pointermove', function (e) {
                if (!_dragging) return;
                applyWeekFromX(e.clientX);
            });
            timelineBar.addEventListener('pointerup',     function () { _dragging = false; });
            timelineBar.addEventListener('pointercancel', function () { _dragging = false; });

            // Keyboard support: arrow keys nudge the week
            timelineBar.addEventListener('keydown', function (e) {
                if (state.pregnancyWeek === null) return;
                var delta = (e.key === 'ArrowRight' || e.key === 'ArrowUp') ? 1
                          : (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') ? -1 : 0;
                if (!delta) return;
                e.preventDefault();
                var week = Math.max(0, Math.min(42, state.pregnancyWeek + delta));
                applyWeekFromX(timelineBar.getBoundingClientRect().left + (week / 42) * timelineBar.offsetWidth);
            });
        }

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
        var day = parseInt(state.pregDay, 10);
        var month = parseInt(state.pregMonth, 10);

        // Enable/disable the Next button immediately based on whether both fields are filled
        var nextBtn = document.getElementById('ev-next-0');
        var isValid = !isNaN(day) && day >= 1 && day <= 31 &&
                      !isNaN(month) && month >= 1 && month <= 12;
        if (nextBtn) nextBtn.disabled = !isValid;

        if (!isValid) return;

        // Date calculation (wrapped in try/catch so any edge case doesn't block the button)
        try {
            var now = new Date();
            var year = now.getFullYear();

            if (state.pregType === 'due') {
                // Due date is in the future — if more than 2 weeks past, assume next year.
                var d = new Date(year, month - 1, day);
                var twoWeeksAgo = new Date();
                twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
                if (d < twoWeeksAgo) {
                    d = new Date(year + 1, month - 1, day);
                }
                state.dueDate = d;
                var lmp = new Date(d.getTime());
                lmp.setDate(lmp.getDate() - 280);
                state.pregDate = lmp;
            } else {
                // LMP is always in the past — if the entered date is in the future, use last year.
                var d = new Date(year, month - 1, day);
                if (d > now) {
                    d = new Date(year - 1, month - 1, day);
                }
                state.pregDate = d;
                var due = new Date(d.getTime());
                due.setDate(due.getDate() + 280);
                state.dueDate = due;
            }

            // Calculate current pregnancy week
            var diffMs = now.getTime() - state.pregDate.getTime();
            var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            state.pregnancyWeek = Math.max(0, Math.floor(diffDays / 7));

            updatePregnancyUI();
        } catch (e) {
            // Date calc failed - button is already enabled above, just hide the info panel
            state.pregnancyWeek = null;
            state.pregDate = null;
            state.dueDate = null;
        }
    }

    function updatePregnancyUI() {
        var info = document.getElementById('ev-preg-info');
        if (!info) return;

        // Static badge visible only when no week selected yet
        var badge = info.querySelector('.ev-preg-badge');
        if (badge) badge.style.display = state.pregnancyWeek !== null ? 'none' : '';

        if (state.pregnancyWeek !== null) {
            var pct = Math.min(100, (state.pregnancyWeek / 42) * 100);

            var progress = info.querySelector('.ev-timeline__progress');
            if (progress) progress.style.width = pct + '%';

            var thumb = document.getElementById('ev-timeline-thumb');
            if (thumb) {
                thumb.style.left    = pct + '%';
                thumb.style.display = '';
            }

            var bar = document.getElementById('ev-timeline-bar');
            if (bar) bar.setAttribute('aria-valuenow', state.pregnancyWeek);

            // Floating week label – clamped to stay within bar bounds
            var label = document.getElementById('ev-timeline-week-label');
            if (label && bar) {
                var labelText = label.querySelector('.ev-timeline__week-label__text');
                if (labelText) labelText.textContent = state.pregnancyWeek + ' weken';
                label.style.display = '';
                var barW  = bar.getBoundingClientRect().width;
                var labelW = label.offsetWidth || 60;
                if (barW > 0) {
                    var thumbPx   = pct / 100 * barW;
                    var clampedPx = Math.max(labelW / 2, Math.min(barW - labelW / 2, thumbPx));
                    label.style.left = (clampedPx / barW * 100) + '%';
                } else {
                    label.style.left = pct + '%';
                }
            }
        }
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
            card.className = 'ev-suggestion' + (sug.discountPct > 0 ? ' ev-suggestion--package' : '');
            card.setAttribute('data-suggestion-idx', idx);

            // Discount stamp for packages
            var stamp = '';
            if (sug.discountPct > 0) {
                stamp = '<div class="ev-suggestion__stamp">' + Math.round(sug.discountPct * 100) + '%<span>korting</span></div>';
            }

            var header = '<div class="ev-suggestion__header">';
            header += '<span class="ev-suggestion__title">' + sug.title + '</span>';
            header += '<span>';
            if (sug.discountPct > 0) {
                header += '<span class="ev-suggestion__price--old">' + euro(sug.originalPrice) + '</span>';
            }
            header += '<span class="ev-suggestion__price">' + euro(sug.price) + '</span>';
            header += '</span></div>';

            // For packages the sub-cards already show all info; desc would be duplicate
            var desc = sug.milestones.length === 1
                ? '<div class="ev-suggestion__desc">' + sug.desc + '</div>'
                : '';

            // For single echo: show content tags; for packages: no duplicate tag strip
            var items = '';
            if (sug.milestones.length === 1 && sug.tags.length > 0) {
                items = '<div class="ev-suggestion__items">';
                sug.tags.forEach(function (tag) {
                    items += '<span class="ev-suggestion__item">' + tag + '</span>';
                });
                items += '</div>';
            }

            card.innerHTML = stamp + header + desc + items;

            // For packages: show each appointment as a mini-card with duration + content
            if (sug.milestones && sug.milestones.length > 1) {
                var apptsDiv = document.createElement('div');
                apptsDiv.className = 'ev-suggestion__appts';
                sug.milestones.forEach(function (m, i) {
                    var dur = sug.durations[i] || sug.durations[0];
                    var rules = getContentRules(dur);
                    var contentTags = buildContentTags(rules);
                    var apptCard = document.createElement('div');
                    apptCard.className = 'ev-suggestion__appt-card';

                    var nameEl = document.createElement('div');
                    nameEl.className = 'ev-suggestion__appt-card__name';
                    nameEl.innerHTML = m.name + ' <span class="ev-suggestion__appt-card__week">week\u00a0' + m.weekStart + '\u2013' + m.weekEnd + '</span>';

                    // Duration pill
                    var durEl = document.createElement('span');
                    durEl.className = 'ev-suggestion__appt-card__dur';
                    durEl.textContent = dur + ' min';

                    // Content tags row
                    var tagsEl = document.createElement('div');
                    tagsEl.className = 'ev-suggestion__appt-card__tags';
                    contentTags.forEach(function (t) {
                        var chip = document.createElement('span');
                        chip.className = 'ev-suggestion__appt-tag';
                        chip.textContent = t;
                        tagsEl.appendChild(chip);
                    });

                    var priceEl = document.createElement('div');
                    priceEl.className = 'ev-suggestion__appt-card__price';
                    priceEl.textContent = euro(calcBasePrice(dur));

                    var leftEl = document.createElement('div');
                    leftEl.className = 'ev-suggestion__appt-card__left';
                    leftEl.appendChild(nameEl);
                    leftEl.appendChild(tagsEl);

                    var rightEl = document.createElement('div');
                    rightEl.className = 'ev-suggestion__appt-card__right';
                    rightEl.appendChild(durEl);
                    rightEl.appendChild(priceEl);

                    apptCard.appendChild(leftEl);
                    apptCard.appendChild(rightEl);
                    apptsDiv.appendChild(apptCard);
                });
                card.appendChild(apptsDiv);
            }

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
            { icon: IC.photo2d, label: rules.photos_2d + 'x 2D beelden',   included: rules.photos_2d > 0 },
            { icon: IC.photo3d, label: rules.photos_3d > 0 ? rules.photos_3d + 'x 3D beelden' : '3D beelden', included: rules.photos_3d > 0 },
            { icon: IC.video,   label: rules.videos_2d > 0 ? rules.videos_2d + 'x 2D video' : '2D video',    included: rules.videos_2d > 0 },
            { icon: IC.film,    label: rules.videos_4d > 0 ? rules.videos_4d + 'x 4D video' : '4D video',    included: rules.videos_4d > 0 },
            { icon: IC.print,   label: rules.prints_a4 > 0 ? rules.prints_a4 + 'x A4 afdruk' : 'A4 afdruk',  included: rules.prints_a4 > 0 },
            { icon: IC.photo,   label: rules.prints_10x15 > 0 ? rules.prints_10x15 + 'x 10\u00d715 afdruk' : '10\u00d715 afdruk', included: rules.prints_10x15 > 0 },
            { icon: IC.usb,     label: 'USB-stick',          included: rules.usb_free },
            { icon: IC.mic,     label: 'Volledige opname',   included: rules.recording_free },
            { icon: IC.heart,   label: 'Geslachtsbepaling',  included: true }
        ];

        items.forEach(function (item) {
            var el = document.createElement('div');
            el.className = 'ev-content-item ' + (item.included ? 'ev-content-item--included' : 'ev-content-item--not-included');
            el.innerHTML = '<span class="ev-content-item__icon">' + item.icon + '</span>' +
                '<span class="ev-content-item__label">' + item.label + '</span>';
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
            container.appendChild(createAddonToggle(
                'add_recording', 'Volledige opname' + (!rules.usb_free ? ' (incl. USB)' : ''),
                PRICING.priceRecording, appt, idx, true
            ));
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

        // Gender (always shown – can opt out)
        container.appendChild(createAddonToggle(
            '_gender_include', 'Geslachtsbepaling', 0, appt, idx, false, true
        ));
    }

    function createAddonToggle(key, label, price, appt, idx, requiresUsb, isFree) {
        var isActive;
        if (key === '_gender_include') {
            isActive = !appt.genderOptOut;
        } else {
            isActive = !!appt.addons[key];
        }

        var item = document.createElement('div');
        item.className = 'ev-addon-item' + (isActive ? ' ev-addon-item--active' : '');

        // Toggle switch
        var sw = document.createElement('label');
        sw.className = 'ev-toggle-sw';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = isActive;
        var track = document.createElement('span');
        track.className = 'ev-toggle-sw__track';
        sw.appendChild(cb);
        sw.appendChild(track);

        // Info
        var infoDiv = document.createElement('div');
        infoDiv.className = 'ev-addon-item__info';
        var labelEl = document.createElement('span');
        labelEl.className = 'ev-addon-item__label';
        labelEl.textContent = label;
        infoDiv.appendChild(labelEl);

        // Price
        var priceEl = document.createElement('span');
        priceEl.className = 'ev-addon-item__price' + (isFree ? ' ev-addon-item__price--free' : '');
        priceEl.textContent = isFree ? 'Gratis' : (price > 0 ? '+ ' + euro(price) : 'Gratis');

        item.appendChild(sw);
        item.appendChild(infoDiv);
        item.appendChild(priceEl);

        function toggle(checked) {
            cb.checked = checked;
            item.classList.toggle('ev-addon-item--active', checked);

            if (key === '_gender_include') {
                appt.genderOptOut = !checked;
            } else {
                appt.addons[key] = checked;
                if (key === 'add_recording' && checked) {
                    appt.addons['add_usb'] = true;
                    renderAppointmentConfigs();
                }
                if (key === 'add_usb' && !checked && appt.addons['add_recording']) {
                    appt.addons['add_recording'] = false;
                    renderAppointmentConfigs();
                }
            }
            updateSidebar();
        }

        cb.addEventListener('change', function () { toggle(this.checked); });
        // Allow clicking anywhere on the card (except the checkbox itself which fires change)
        item.addEventListener('click', function (e) {
            if (e.target === cb || e.target === track || e.target === sw) return;
            toggle(!cb.checked);
        });

        return item;
    }

    function createAddonQty(key, label, unitPrice, freeText, appt, idx) {
        var item = document.createElement('div');
        item.className = 'ev-addon-item ev-addon-item--qty';

        var qty = parseInt(appt.addons[key] || 0, 10);
        if (qty > 0) item.classList.add('ev-addon-item--active');

        // Qty control
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

        control.appendChild(minusBtn);
        control.appendChild(valInput);
        control.appendChild(plusBtn);

        // Info section
        var infoDiv = document.createElement('div');
        infoDiv.className = 'ev-addon-item__info';
        var labelEl = document.createElement('span');
        labelEl.className = 'ev-addon-item__label';
        labelEl.textContent = label;
        infoDiv.appendChild(labelEl);
        if (freeText) {
            var subEl = document.createElement('span');
            subEl.className = 'ev-addon-item__sub';
            subEl.textContent = freeText;
            infoDiv.appendChild(subEl);
        }

        var priceEl = document.createElement('span');
        priceEl.className = 'ev-addon-item__price';
        priceEl.textContent = qty > 0 ? '+ ' + euro(qty * unitPrice) : euro(0);

        item.appendChild(control);
        item.appendChild(infoDiv);
        item.appendChild(priceEl);

        function setQty(v) {
            valInput.value = v;
            appt.addons[key] = v;
            priceEl.textContent = v > 0 ? '+ ' + euro(v * unitPrice) : euro(0);
            item.classList.toggle('ev-addon-item--active', v > 0);
            updateSidebar();
        }

        minusBtn.addEventListener('click', function () {
            var v = parseInt(valInput.value, 10);
            if (v > 0) setQty(v - 1);
        });
        plusBtn.addEventListener('click', function () {
            var v = parseInt(valInput.value, 10);
            if (v < 20) setQty(v + 1);
        });

        return item;
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

    /* ═══════════════════════════════════════════════════════
       STEP 3: Extra's
       ═══════════════════════════════════════════════════════ */
    function bindExtrasStep() {
        var backBtn = document.getElementById('ev-back-3');
        if (backBtn) backBtn.addEventListener('click', function () { setStep(2); });

        var nextBtn = document.getElementById('ev-next-3');
        if (nextBtn) nextBtn.addEventListener('click', function () { setStep(4); });
    }

    function renderExtrasStep() {
        var container = document.getElementById('ev-extras-panels');
        if (!container) return;
        container.innerHTML = '';

        state.appointments.forEach(function (appt, idx) {
            var card = document.createElement('div');
            card.className = 'ev-appt-card';

            var title = state.packageQty > 1 ? 'Echo ' + (idx + 1) : 'Jouw echo';
            if (appt.milestone) title += ' \u2013 ' + appt.milestone.name;
            card.innerHTML = '<div class="ev-appt-card__title">' + title + ' \u2013 ' + appt.duration + ' min</div>';

            var addonsEl = document.createElement('div');
            addonsEl.className = 'ev-addons';
            renderAddons(addonsEl, appt, idx);
            card.appendChild(addonsEl);

            container.appendChild(card);
        });
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

        // Banner above the grid: optimal range for this milestone
        if (optStart && optEnd && appt.milestone) {
            var optLegend = document.createElement('div');
            optLegend.className = 'ev-calendar__optimal-legend';
            optLegend.innerHTML =
                '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' +
                '<span>Aanbevolen voor <strong>' + appt.milestone.name + '</strong>: week\u00a0' + appt.milestone.weekStart + '\u2013' + appt.milestone.weekEnd + '</span>';
            container.insertBefore(optLegend, grid);
        }
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

        var hasAdjacent = slots.some(function (s) { return s.is_adjacent; });

        slots.forEach(function (slot) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ev-timeslot';

            if (slot.is_adjacent) {
                btn.classList.add('ev-timeslot--adjacent');
            } else if (!slot.is_peak) {
                btn.classList.add('ev-timeslot--cheap');
            }

            if (appt.selectedSlot && appt.selectedSlot.time === slot.time && appt.selectedSlot.staff_id === slot.staff_id) {
                btn.classList.add('ev-timeslot--selected');
            }

            var html = slot.time + '<span class="ev-timeslot__staff">' + slot.staff_name + '</span>';
            if (slot.is_adjacent) {
                html += '<span class="ev-timeslot__badge">5% korting</span>';
            }
            btn.innerHTML = html;

            btn.addEventListener('click', function () {
                appt.selectedSlot = slot;
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
        var legendHtml = '<span><span class="ev-timeslot-legend__dot ev-timeslot-legend__dot--cheap"></span>Voordelig (dagtarief)</span>';
        if (hasAdjacent) {
            legendHtml += '<span><span class="ev-timeslot-legend__dot ev-timeslot-legend__dot--adjacent"></span>Aansluitkorting (5%)</span>';
        }
        legend.innerHTML = legendHtml +
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
       STEP 4: Customer details
       ═══════════════════════════════════════════════════════ */
    function bindStep4() {
        var backBtn = document.getElementById('ev-back-4');
        if (backBtn) backBtn.addEventListener('click', function () { setStep(3); });

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
            },
            voucher_code: state.voucher ? state.voucherCode : '',
            page_url: CFG.pageUrl || (window.location.origin + window.location.pathname)
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
                    if (resp.data && resp.data.requires_payment && resp.data.checkout_url) {
                        showPaymentRedirect(resp.data.checkout_url);
                    } else {
                        showSuccess(resp.data);
                    }
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
        hidePanels();

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

        hideSidebar();
        markStepsDone();
    }

    function hidePanels() {
        document.querySelectorAll('.ev-panel').forEach(function (p) { p.style.display = 'none'; });
    }

    function hideSidebar() {
        var sidebar = document.getElementById('ev-sidebar');
        if (sidebar) sidebar.style.display = 'none';
    }

    function markStepsDone() {
        document.querySelectorAll('.ev-step').forEach(function (s) {
            s.classList.remove('ev-step--active');
            s.classList.add('ev-step--done');
        });
    }

    function showPaymentRedirect(checkoutUrl) {
        hidePanels();
        var panel = document.querySelector('[data-panel="payment"]');
        if (panel) panel.style.display = '';
        hideSidebar();
        // Redirect after a brief moment so the user sees the screen
        setTimeout(function () {
            window.location.href = checkoutUrl;
        }, 1200);
    }

    function handlePaymentReturn(data) {
        hidePanels();
        hideSidebar();
        markStepsDone();
        // Hide step bar
        var steps = document.querySelector('.ev-steps');
        if (steps) steps.style.display = 'none';

        var returnPanel;
        if (data.status === 'paid') {
            showSuccess(data);
        } else if (data.status === 'pending') {
            returnPanel = document.querySelector('[data-panel="pending"]');
            if (returnPanel) returnPanel.style.display = '';
        } else {
            returnPanel = document.querySelector('[data-panel="failed"]');
            if (returnPanel) returnPanel.style.display = '';
        }
    }

    /* ═══════════════════════════════════════════════════════
       Voucher / coupon code
       ═══════════════════════════════════════════════════════ */
    function bindVoucher() {
        var applyBtn = document.getElementById('ev-apply-voucher');
        var voucherInput = document.getElementById('ev-voucher');
        var resultEl = document.getElementById('ev-voucher-result');
        if (!applyBtn || !voucherInput) return;

        function setResult(type, msg) {
            if (!resultEl) return;
            resultEl.className = 'ev-voucher-result' + (type ? ' ev-voucher-result--' + type : '');
            resultEl.textContent = msg;
        }

        function resetVoucher() {
            state.voucher = null;
            state.voucherCode = '';
            applyBtn.textContent = 'Toepassen';
            voucherInput.disabled = false;
            setResult('', '');
            updateSidebar();
        }

        applyBtn.addEventListener('click', function () {
            // If voucher already applied, act as remove button
            if (state.voucher) {
                resetVoucher();
                return;
            }

            var code = voucherInput.value.trim().toUpperCase();
            if (!code) return;

            applyBtn.disabled = true;
            applyBtn.textContent = 'Controleren...';

            var fd = new FormData();
            fd.append('action', 'echovisie_validate_voucher');
            fd.append('nonce', CFG.nonce);
            fd.append('code', code);

            fetch(CFG.ajaxUrl, { method: 'POST', body: fd })
                .then(function (r) { return r.json(); })
                .then(function (resp) {
                    applyBtn.disabled = false;
                    if (resp.success) {
                        state.voucher = {
                            discount_pct: resp.data.discount_pct || 0,
                            deduction: resp.data.deduction || 0,
                            label: resp.data.label || 'Korting'
                        };
                        state.voucherCode = code;
                        voucherInput.disabled = true;
                        applyBtn.textContent = 'Verwijderen';
                        setResult('ok', '\u2713 ' + resp.data.label + ' toegepast');
                        updateSidebar();
                    } else {
                        setResult('err', resp.data && resp.data.message || 'Ongeldige code.');
                        applyBtn.textContent = 'Toepassen';
                    }
                })
                .catch(function () {
                    applyBtn.disabled = false;
                    applyBtn.textContent = 'Toepassen';
                    setResult('err', 'Kon de code niet valideren.');
                });
        });

        // Reset when user types a new code
        voucherInput.addEventListener('input', function () {
            if (state.voucher) resetVoucher();
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
        } else if (n === 3) {
            renderExtrasStep();
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
            var adjacentDiscount = 0;
            if (appt.selectedSlot && appt.selectedSlot.is_adjacent) {
                adjacentDiscount = Math.round((base + addonTotal + surcharge) * 0.05 * 100) / 100;
            }
            var apptTotal = base + addonTotal + surcharge - adjacentDiscount;
            subtotal += apptTotal;

            html += '<div class="ev-sidebar__appt">';
            html += '<div class="ev-sidebar__appt-title">' +
                (state.packageQty > 1 ? 'Echo ' + (idx + 1) : 'Jouw echo') +
                ' \u2013 ' + appt.duration + ' min</div>';

            var tags = [];
            if (rules.photos_2d > 0)                      tags.push(IC.photo2d + ' ' + rules.photos_2d + 'x&nbsp;2D');
            if (rules.photos_3d > 0 || appt.addons.add_3d) tags.push(IC.photo3d + ' ' + (rules.photos_3d || '') + 'x&nbsp;3D');
            if (rules.videos_4d > 0)                       tags.push(IC.film    + ' ' + rules.videos_4d + 'x&nbsp;4D');
            if (!appt.genderOptOut)                        tags.push(IC.heart   + ' Geslacht');
            if (rules.usb_free || appt.addons.add_usb)    tags.push(IC.usb     + ' USB');
            if (rules.recording_free || appt.addons.add_recording) tags.push(IC.mic + ' Opname');

            var tagsHtml = tags.map(function (t) {
                return '<span class="ev-sidebar__tag">' + t + '</span>';
            }).join('');
            html += '<div class="ev-sidebar__appt-tags">' + tagsHtml + '</div>';

            if (appt.date || appt.selectedSlot) {
                var meta = [];
                if (appt.date) meta.push(formatDateNL(appt.date));
                if (appt.selectedSlot) meta.push(appt.selectedSlot.time + '\u00a0' + appt.selectedSlot.staff_name);
                html += '<div class="ev-sidebar__appt-meta">' + meta.join(' \u00b7 ') + '</div>';
            }
            html += '<div class="ev-sidebar__appt-price">' + euro(apptTotal) + '</div>';
            html += '</div>';
        });

        content.innerHTML = html;

        // Package discount
        var discountPct = state.packageQty >= 3 ? 0.20 : (state.packageQty >= 2 ? 0.10 : 0);
        var discountAmt = Math.round(subtotal * discountPct * 100) / 100;
        var total = Math.round((subtotal - discountAmt) * 100) / 100;

        // Voucher discount (applied after package discount)
        var voucherAmt = 0;
        if (state.voucher) {
            if (state.voucher.discount_pct > 0) {
                voucherAmt += Math.round(total * (state.voucher.discount_pct / 100) * 100) / 100;
            }
            if (state.voucher.deduction > 0) {
                voucherAmt += state.voucher.deduction;
            }
            voucherAmt = Math.min(voucherAmt, total);
            total = Math.round((total - voucherAmt) * 100) / 100;
        }

        // Remove existing discount/voucher rows
        var existing = document.querySelectorAll('.ev-sidebar__discount, .ev-sidebar__voucher');
        existing.forEach(function (el) { el.remove(); });

        if (discountPct > 0) {
            var discountRow = document.createElement('div');
            discountRow.className = 'ev-sidebar__discount';
            discountRow.innerHTML = '<span>Pakketkorting <span class="ev-discount-badge">' + Math.round(discountPct * 100) + '%</span></span><span>\u2212\u00a0' + euro(discountAmt) + '</span>';
            if (totalEl) totalEl.parentNode.insertBefore(discountRow, totalEl);
        }

        if (state.voucher && voucherAmt > 0) {
            var voucherRow = document.createElement('div');
            voucherRow.className = 'ev-sidebar__voucher';
            voucherRow.innerHTML = '<span>' + state.voucher.label + '</span><span>- ' + euro(voucherAmt) + '</span>';
            if (totalEl) totalEl.parentNode.insertBefore(voucherRow, totalEl);
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
        return (PRICING.basePrice || 0) + (PRICING.pricePerBlock || 15) * (duration / 10);
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
        return tags;
    }

})();
