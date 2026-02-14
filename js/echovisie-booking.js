/**
 * EchoVisie Booking Widget – Interactive logic & pricing engine
 * 2-step wizard: "Jouw echo" + "Afspraak plannen"
 */
(function () {
    'use strict';

    /* =========================================================
       CONSTANTS
       ========================================================= */
    var MONTHS_NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
                     'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
    var DAY_MS  = 86400000; // used only for UTC day-diff calculations
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

    var STEP_LABELS = ['Jouw echo', 'Afspraak plannen'];
    var DAYTIME_CUTOFF = '17:00';

    // Admin-configurable suggestion defaults (loaded from PHP via wp_localize_script)
    var SUGGESTION_CONFIGS = (typeof echovisieBooking !== 'undefined' && echovisieBooking.suggestions) || {
        gender:   { duration: 20, addons: ['usb'] },
        pretecho: { duration: 40, addons: ['recording'] },
        growth:   { duration: 30, addons: ['recording'] }
    };

    /* =========================================================
       STATE
       ========================================================= */
    var state = {
        currentStep: 0,
        packageQty: 1,
        pregType: null,          // 'due' | 'lmp' | null
        pregDate: '',            // YYYY-MM-DD
        pregDay: '',             // day from dropdown (1-31)
        pregMonth: '',           // month from dropdown (1-12)
        selectedSuggestion: null, // null | 'custom' | index of chosen suggestion

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
            customized: false,
            milestone: null
        };
    }

    function getEffectiveConfig(idx) {
        if (idx === 0 || state.appointments[idx].customized) {
            return state.appointments[idx];
        }
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
        return 'unknown';
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

    /** Add/subtract calendar days – DST-safe (uses setDate instead of ms arithmetic) */
    function addDays(date, days) {
        var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        d.setDate(d.getDate() + days);
        return d;
    }

    /* =========================================================
       YEAR INFERENCE FOR DAY/MONTH DROPDOWNS
       ========================================================= */
    function inferYear(day, month, pregType, now) {
        var currentYear = now.getFullYear();
        if (pregType === 'due') {
            // Due date must be in the future
            var candidate = new Date(currentYear, month - 1, day);
            return candidate > now ? currentYear : currentYear + 1;
        } else {
            // LMP date must be in the past (within ~9 months)
            var candidate2 = new Date(currentYear, month - 1, day);
            return candidate2 <= now ? currentYear : currentYear - 1;
        }
    }

    function updatePregDateFromDropdowns() {
        var dayEl   = document.getElementById('ev-preg-day');
        var monthEl = document.getElementById('ev-preg-month');
        if (!dayEl || !monthEl) return;

        var day   = parseInt(dayEl.value, 10);
        var month = parseInt(monthEl.value, 10);

        state.pregDay = dayEl.value;
        state.pregMonth = monthEl.value;

        if (!day || !month || !state.pregType) {
            state.pregDate = '';
            hideSuggestionsWrapper();
            renderPregnancy();
            return;
        }

        var now  = today();
        var year = inferYear(day, month, state.pregType, now);

        // Validate day for the given month/year
        var maxDay = new Date(year, month, 0).getDate();
        if (day > maxDay) {
            showPregDropdownError('Deze dag bestaat niet in ' + MONTHS_NL[month - 1] + '.');
            state.pregDate = '';
            hideSuggestionsWrapper();
            return;
        }

        // Format as YYYY-MM-DD
        var m = ('0' + month).slice(-2);
        var d = ('0' + day).slice(-2);
        state.pregDate = year + '-' + m + '-' + d;

        clearPregDropdownError();

        // Validate the resulting date
        var error = validatePregDate();
        if (error) {
            showPregDropdownError(error);
            hideSuggestionsWrapper();
            return;
        }

        // Reset suggestion when pregnancy info changes
        state.selectedSuggestion = null;
        var customEl = document.getElementById('ev-custom-configurator');
        if (customEl) customEl.style.display = 'none';
        hideSidebar();

        renderPregnancy();
        showSuggestionsInline();
    }

    function showPregDropdownError(msg) {
        var wrap = document.getElementById('ev-preg-date-error-wrap');
        if (!wrap) return;
        wrap.innerHTML = '<div class="ev-preg-error">' + msg + '</div>';
    }

    function clearPregDropdownError() {
        var wrap = document.getElementById('ev-preg-date-error-wrap');
        if (wrap) wrap.innerHTML = '';
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
        return addDays(due, -PREGNANCY_DAYS);
    }

    function getCurrentWeek() {
        var lmp = getLmpDate();
        if (!lmp) return null;
        var t = today();
        var daysDiff = Math.round(
            (Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) -
             Date.UTC(lmp.getFullYear(), lmp.getMonth(), lmp.getDate())) / DAY_MS
        );
        return Math.floor(daysDiff / 7);
    }

    function getDueDate() {
        var lmp = getLmpDate();
        if (!lmp) return null;
        return addDays(lmp, PREGNANCY_DAYS);
    }

    function getDateForWeek(weekNum) {
        var lmp = getLmpDate();
        if (!lmp) return null;
        return addDays(lmp, weekNum * 7);
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
       SUGGESTION PACKAGES – built dynamically from pregnancy week
       ========================================================= */
    function buildSuggestionPackages() {
        var currentWeek = getCurrentWeek();
        if (currentWeek === null) return [];

        var available = [];
        for (var i = 0; i < MILESTONES.length; i++) {
            if (currentWeek <= MILESTONES[i].weekEnd) {
                available.push(MILESTONES[i]);
            }
        }
        if (available.length === 0) return [];

        var packages = [];
        for (var count = 1; count <= available.length; count++) {
            var appointments = [];
            for (var j = 0; j < count; j++) {
                var ms = available[j];
                var cfg = SUGGESTION_CONFIGS[ms.id] || { duration: 20, addons: [] };
                appointments.push({
                    milestone: ms,
                    duration: cfg.duration,
                    addons: cfg.addons || []
                });
            }

            var rawTotal = 0;
            for (var k = 0; k < appointments.length; k++) {
                var apt = appointments[k];
                var base = standardPrice(apt.duration);
                var addonsTotal = 0;
                var addonDefs = buildAddons(apt.duration);
                for (var m = 0; m < apt.addons.length; m++) {
                    for (var n = 0; n < addonDefs.length; n++) {
                        if (addonDefs[n].id === apt.addons[m] && addonDefs[n].unitPrice > 0) {
                            addonsTotal += addonDefs[n].unitPrice;
                        }
                    }
                }
                rawTotal += base + addonsTotal;
            }
            var disc = packageDiscount(count);
            var total = rawTotal - (rawTotal * disc);

            packages.push({
                count: count,
                appointments: appointments,
                rawTotal: rawTotal,
                discount: disc,
                total: total
            });
        }
        return packages;
    }

    function buildAddonLabel(addonId) {
        var labels = {
            recording: 'Volledige opname',
            usb: 'USB-stick'
        };
        return labels[addonId] || addonId;
    }

    /** Build visual badge data for suggestion cards */
    function buildIncludedBadges(duration, addonIds) {
        var badges = [];
        var n2d = included2D(duration);
        if (n2d > 0) badges.push({ icon: '\uD83D\uDCF7', label: n2d + 'x 2D' });
        var n3d = included3D(duration);
        if (n3d > 0) badges.push({ icon: '\uD83E\uDD30', label: n3d + 'x 3D' });
        var n4d = included4D(duration);
        if (n4d > 0) badges.push({ icon: '\uD83C\uDFAC', label: n4d + 'x 4D' });
        if (genderAvailable(duration)) badges.push({ icon: '\uD83D\uDC76', label: 'Geslacht' });
        var freeSmall = freeSmallPhotos(duration);
        if (freeSmall > 0) badges.push({ icon: '\uD83D\uDDBC\uFE0F', label: freeSmall + 'x foto' });
        if (freeLargePhotos(duration) > 0) badges.push({ icon: '\uD83D\uDDBC\uFE0F', label: '1x groot' });
        if (recordingFree(duration)) badges.push({ icon: '\uD83C\uDFA5', label: 'Opname' });
        if (usbFree(duration)) badges.push({ icon: '\uD83D\uDD0C', label: 'USB' });
        // Add non-free addons included in the suggestion
        for (var i = 0; i < addonIds.length; i++) {
            if (addonIds[i] === 'recording' && !recordingFree(duration)) badges.push({ icon: '\uD83C\uDFA5', label: 'Opname' });
            if (addonIds[i] === 'usb' && !usbFree(duration)) badges.push({ icon: '\uD83D\uDD0C', label: 'USB' });
        }
        return badges;
    }

    function renderSuggestions() {
        var container = document.getElementById('ev-suggestions-container');
        if (!container) return;

        var packages = buildSuggestionPackages();
        var html = '';

        if (packages.length === 0) {
            html += '<div class="ev-suggestion-empty">';
            html += '<p>Op basis van je zwangerschapsweek zijn er helaas geen standaard echo-momenten meer beschikbaar.</p>';
            html += '<p>Je kunt hieronder nog wel zelf een echo samenstellen.</p>';
            html += '</div>';
        } else {
            var packageTitles = ['Enkele echo', 'Pakket van 2 echo\'s', 'Pakket van 3 echo\'s'];
            html += '<div class="ev-suggestions-grid">';
            for (var i = 0; i < packages.length; i++) {
                var pkg = packages[i];
                var isHighlight = packages.length > 1 && i === packages.length - 1;
                var isSelected = state.selectedSuggestion === i;
                var cardCls = 'ev-suggestion-card';
                if (isHighlight) cardCls += ' ev-suggestion-highlight';
                if (isSelected) cardCls += ' ev-suggestion-selected';
                html += '<div class="' + cardCls + '" data-suggestion="' + i + '">';
                if (isHighlight) {
                    html += '<div class="ev-suggestion-badge">Meeste waarde</div>';
                }
                html += '<h4 class="ev-suggestion-title">' + packageTitles[pkg.count - 1] + '</h4>';

                for (var j = 0; j < pkg.appointments.length; j++) {
                    var apt = pkg.appointments[j];
                    html += '<div class="ev-suggestion-apt">';
                    html += '<span class="ev-suggestion-apt-icon">' + apt.milestone.icon + '</span>';
                    html += '<div class="ev-suggestion-apt-info">';
                    html += '<strong>' + apt.milestone.name + '</strong>';
                    html += '<span class="ev-suggestion-apt-weeks">Week ' + apt.milestone.weekStart + '\u2013' + apt.milestone.weekEnd + ' \u00B7 ' + apt.duration + ' min</span>';

                    // Badge pills instead of comma text
                    var badges = buildIncludedBadges(apt.duration, apt.addons);
                    html += '<div class="ev-suggestion-badges">';
                    for (var b = 0; b < badges.length; b++) {
                        html += '<span class="ev-badge-pill">' + badges[b].icon + ' ' + badges[b].label + '</span>';
                    }
                    html += '</div>';

                    html += '</div>';
                    html += '</div>';
                }

                html += '<div class="ev-suggestion-price">';
                if (pkg.discount > 0) {
                    html += '<span class="ev-suggestion-price-original">' + euro(pkg.rawTotal) + '</span> ';
                    html += '<span class="ev-suggestion-price-discount">\u2212' + Math.round(pkg.discount * 100) + '%</span> ';
                }
                html += '<span class="ev-suggestion-price-total">' + euro(pkg.total) + '</span>';
                html += '</div>';

                html += '<button type="button" class="ev-suggestion-choose-btn" data-suggestion="' + i + '">' + (isSelected ? '\u2713 Geselecteerd' : 'Kies dit' + (pkg.count > 1 ? ' pakket' : '')) + '</button>';
                html += '</div>';
            }
            html += '</div>';
        }

        html += '<div class="ev-custom-option">';
        html += '<button type="button" class="ev-custom-option-btn" id="ev-custom-btn">Zelf samenstellen</button>';
        html += '<p class="ev-custom-option-hint">Stel je eigen echo samen met onze configurator</p>';
        html += '</div>';

        container.innerHTML = html;
    }

    function applySuggestion(index) {
        var packages = buildSuggestionPackages();
        if (index < 0 || index >= packages.length) return;

        var pkg = packages[index];
        state.selectedSuggestion = index;
        state.packageQty = pkg.count;

        // Reset appointments array
        state.appointments = [];
        for (var i = 0; i < pkg.count; i++) {
            var aptCfg = pkg.appointments[i];
            var apt = makeDefaultAppointment();
            apt.duration = aptCfg.duration;
            apt.customized = true;
            apt.milestone = aptCfg.milestone;

            for (var j = 0; j < aptCfg.addons.length; j++) {
                apt.addons[aptCfg.addons[j]] = { qty: 1 };
            }
            resetAutoSelectionsForApt2(apt);
            state.appointments.push(apt);
        }

        // Hide custom configurator
        var customEl = document.getElementById('ev-custom-configurator');
        if (customEl) customEl.style.display = 'none';

        // Stay on step 0, highlight the card, show sidebar
        renderSuggestions();
        showSidebar();
        renderSummary();
    }

    function resetAutoSelectionsForApt2(apt) {
        var addons = buildAddons(apt.duration);
        for (var i = 0; i < addons.length; i++) {
            var a = addons[i];
            if (a.autoSelected && !apt.addons[a.id]) {
                apt.addons[a.id] = { qty: 1 };
            }
        }
    }

    function showCustomConfigurator() {
        state.selectedSuggestion = 'custom';
        state.packageQty = 1;
        state.appointments = [makeDefaultAppointment()];

        var customEl = document.getElementById('ev-custom-configurator');
        if (customEl) customEl.style.display = '';

        var aptCfgSection = document.getElementById('ev-custom-apt-configs-section');
        if (aptCfgSection) aptCfgSection.style.display = 'none';

        renderIncludedGrid();
        renderAddons();
        showSidebar();
        renderSummary();
        renderSuggestions();

        var slider = document.getElementById('ev-duration-slider');
        if (slider) {
            slider.value = state.appointments[0].duration;
            var durationLabel = document.getElementById('ev-duration-value');
            if (durationLabel) durationLabel.textContent = state.appointments[0].duration;
        }
    }

    /* =========================================================
       INLINE SUGGESTIONS & SIDEBAR VISIBILITY
       ========================================================= */
    function showSuggestionsInline() {
        var wrapper = document.getElementById('ev-suggestions-wrapper');
        if (!wrapper) return;
        wrapper.style.display = '';
        // Re-trigger animation by removing and re-adding class
        wrapper.classList.remove('ev-section-reveal');
        void wrapper.offsetWidth; // force reflow
        wrapper.classList.add('ev-section-reveal');
        renderSuggestions();
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideSuggestionsWrapper() {
        var wrapper = document.getElementById('ev-suggestions-wrapper');
        if (wrapper) wrapper.style.display = 'none';
    }

    function showSidebar() {
        var sidebar = document.getElementById('ev-sidebar');
        if (sidebar) {
            sidebar.style.display = '';
            sidebar.classList.add('ev-sidebar-visible');
        }
    }

    function hideSidebar() {
        var sidebar = document.getElementById('ev-sidebar');
        if (sidebar) sidebar.style.display = 'none';
    }

    /* =========================================================
       INLINE TIMESLOTS (auto-fetch when all dates filled)
       ========================================================= */
    function checkAndFetchTimeslots() {
        var allDatesSet = true;
        for (var i = 0; i < state.packageQty; i++) {
            if (!state.appointments[i].date) {
                allDatesSet = false;
                break;
            }
        }

        var wrapper = document.getElementById('ev-timeslots-wrapper');
        if (wrapper) {
            wrapper.style.display = allDatesSet ? '' : 'none';
        }

        if (allDatesSet) {
            fetchAvailableSlots();
        }
    }

    function checkAndShowCustomerFields() {
        var allSlotsSelected = true;
        for (var k = 0; k < state.packageQty; k++) {
            if (!state.selectedSlots[k]) { allSlotsSelected = false; break; }
        }
        var custWrapper = document.getElementById('ev-customer-wrapper');
        if (custWrapper) {
            if (allSlotsSelected) {
                custWrapper.style.display = '';
                custWrapper.classList.add('ev-section-reveal');
            } else {
                custWrapper.style.display = 'none';
            }
        }
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

    function validateStep(step) {
        if (step === 0) {
            if (!state.pregType) return 'Kies eerst je datumtype (uitgerekende datum of laatste menstruatie).';
            if (!state.pregDate) return 'Vul je dag en maand in om verder te gaan.';
            var error = validatePregDate();
            if (error) return error;
            if (state.selectedSuggestion === null) return 'Kies een aanbeveling of stel zelf samen.';
        }
        return null;
    }

    function setStep(step) {
        if (step < 0 || step >= STEP_LABELS.length) return;

        // Validate current step before advancing
        if (step > state.currentStep) {
            // Re-sync pregnancy date from DOM in case change events didn't fire
            if (state.currentStep === 0) {
                updatePregDateFromDropdowns();
            }
            var validationError = validateStep(state.currentStep);
            if (validationError) {
                showStepError(validationError);
                return;
            }
        }

        state.currentStep = step;

        var panels = document.querySelectorAll('.ev-step-panel');
        for (var i = 0; i < panels.length; i++) {
            panels[i].style.display = parseInt(panels[i].getAttribute('data-step'), 10) === step ? '' : 'none';
        }

        renderStepBar();
        renderStepNav();

        if (step === 0) {
            renderPregnancy();
            if (state.pregDate && !validatePregDate()) {
                showSuggestionsInline();
            }
            if (state.selectedSuggestion === 'custom') {
                var customEl = document.getElementById('ev-custom-configurator');
                if (customEl) customEl.style.display = '';
                renderIncludedGrid();
                renderAddons();
            }
        }
        if (step === 1) {
            renderDatePickers();
            checkAndFetchTimeslots();
            checkAndShowCustomerFields();
        }
    }

    function showStepError(message) {
        var existing = document.querySelector('.ev-step-error');
        if (existing) existing.remove();
        var errEl = document.createElement('div');
        errEl.className = 'ev-step-error ev-preg-error';
        errEl.textContent = message;
        var nav = document.getElementById('ev-step-nav');
        if (nav) nav.parentNode.insertBefore(errEl, nav);
        setTimeout(function () { if (errEl.parentNode) errEl.remove(); }, 4000);
    }

    /* =========================================================
       CONFIGURATOR RENDERERS (used in custom flow, step 0)
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
       APPOINTMENT CONFIGS (per-appointment, custom flow)
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
            html += '<span class="ev-apt-card-summary">' + cfg.duration + ' min';
            html += ' &middot; vanaf ' + euro(standardPrice(cfg.duration)) + '</span>';
            html += '</div>';

            if (i > 0) {
                html += '<div class="ev-apt-toggle-bar">';
                html += '<button type="button" class="ev-apt-toggle-btn' + (!apt.customized ? ' active' : '') + '" data-apt="' + i + '" data-action="inherit">Zelfde als afspraak 1</button>';
                html += '<button type="button" class="ev-apt-toggle-btn' + (apt.customized ? ' active' : '') + '" data-apt="' + i + '" data-action="customize">Aanpassen</button>';
                html += '</div>';
            }

            if (i === 0 || apt.customized) {
                html += renderMiniConfigurator(i, cfg);
            }

            html += '</div>';
        }

        container.innerHTML = html;

        for (var j = 0; j < state.packageQty; j++) {
            if (j === 0 || state.appointments[j].customized) {
                bindMiniSlider(j);
            }
        }
    }

    function renderMiniConfigurator(aptIdx, cfg) {
        var html = '<div class="ev-apt-mini-config" data-apt="' + aptIdx + '">';

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

        var addons = buildAddons(cfg.duration);
        html += '<div class="ev-apt-mini-row">';
        html += '<label class="ev-label">Extra opties</label>';
        html += '<div class="ev-addons-list ev-mini-addons" data-apt="' + aptIdx + '">';
        for (var i = 0; i < addons.length; i++) {
            var a = addons[i];
            var addonState = cfg.addons[a.id] || { qty: 0 };
            if (a.autoSelected && !cfg.addons[a.id]) {
                cfg.addons[a.id] = { qty: 1 };
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
       STEP 0 – PREGNANCY INFO & STEP 1 – DATE PICKERS
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
        var currentWeek = getCurrentWeek();
        var minDate = formatDateISO(addDays(today(), 1));
        var html = '';

        var fallbackSuggestions = suggestAppointmentDates(qty);

        for (var i = 0; i < qty; i++) {
            var apt = state.appointments[i];
            var label = qty === 1
                ? 'Kies je afspraakdatum'
                : 'Afspraak ' + (i + 1);

            var sug = null;
            if (apt.milestone && currentWeek !== null) {
                var ms = apt.milestone;
                if (currentWeek <= ms.weekEnd) {
                    var idealWeek = Math.max(ms.weekIdeal, currentWeek + 1);
                    idealWeek = Math.min(idealWeek, ms.weekEnd);
                    sug = {
                        milestone: ms,
                        idealDate: getDateForWeek(idealWeek),
                        rangeStart: getDateForWeek(Math.max(ms.weekStart, currentWeek + 1)),
                        rangeEnd: getDateForWeek(ms.weekEnd)
                    };
                }
            } else {
                sug = fallbackSuggestions[i] || null;
            }

            html += '<div class="ev-date-group">';
            if (apt.milestone) {
                html += '<label class="ev-date-label">' + apt.milestone.icon + ' ' + apt.milestone.name;
                if (qty > 1) html += ' (afspraak ' + (i + 1) + ')';
                html += '</label>';
            } else {
                html += '<label class="ev-date-label">' + label + '</label>';
            }

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
       TIMESLOT SELECTION & BOOKING (step 1 inline)
       ========================================================= */
    function fetchAvailableSlots() {
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
                    state.availableSlots = {};
                    state.alternativeDates = {};
                    var rawSlots = resp.data.slots;
                    for (var key in rawSlots) {
                        if (rawSlots.hasOwnProperty(key)) {
                            var entry = rawSlots[key];
                            if (Array.isArray(entry)) {
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
                html += '<p class="ev-slot-no-date">Kies eerst een gewenste datum hierboven</p>';
            } else if (slots.length === 0) {
                var origDate = parseDate(aptLive.date);
                html += '<p class="ev-slot-no-date">Geen beschikbare tijdsloten op <strong>' + formatDateNL(origDate) + '</strong>.</p>';

                if (alts.length > 0) {
                    html += renderAlternatives(i, alts);
                } else {
                    html += '<p class="ev-slot-no-date" style="margin-top:.5rem;">Er zijn de komende 14 dagen geen beschikbare tijdsloten gevonden. Kies een andere datum.</p>';
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

        if (nameEl) state.customerName = nameEl.value.trim();
        if (emailEl) state.customerEmail = emailEl.value.trim();
        if (phoneEl) state.customerPhone = phoneEl.value.trim();

        if (!state.customerName) errors.push('Vul je naam in.');
        if (!state.customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.customerEmail)) {
            errors.push('Vul een geldig e-mailadres in.');
        }
        if (!state.customerPhone) errors.push('Vul je telefoonnummer in.');

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
            html += '<p style="margin:.4rem 0;font-size:.88rem;"><strong>Tijd:</strong> ' + (slot.time || '\u2013') + '</p>';
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
            renderPregnancy();
            if (state.pregDate && !validatePregDate()) {
                showSuggestionsInline();
            }
            if (state.selectedSuggestion === 'custom') {
                renderIncludedGrid();
                renderAddons();
            }
        }
        if (state.currentStep === 1) {
            renderDatePickers();
            renderTimeslots();
        }
        if (state.selectedSuggestion !== null) {
            renderSummary();
        }
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
        var bookingEl = document.getElementById('echovisie-booking');
        if (!bookingEl) return;

        setStep(0);

        // Duration slider (inside custom configurator in step 0)
        var slider = document.getElementById('ev-duration-slider');
        var durationLabel = document.getElementById('ev-duration-value');
        if (slider) {
            slider.addEventListener('input', function () {
                state.appointments[0].duration = parseInt(this.value, 10);
                if (durationLabel) durationLabel.textContent = state.appointments[0].duration;
                resetAutoSelectionsForApt(0);
                renderIncludedGrid();
                renderAddons();
                renderSummary();

                var aptCfgSection = document.getElementById('ev-custom-apt-configs-section');
                if (aptCfgSection && state.packageQty > 1) {
                    aptCfgSection.style.display = '';
                    renderAppointmentConfigs();
                }
            });
        }

        // Package buttons (inside custom configurator)
        document.querySelectorAll('.ev-package-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.ev-package-btn').forEach(function (b) { b.classList.remove('active'); });
                this.classList.add('active');
                state.packageQty = parseInt(this.getAttribute('data-qty'), 10);
                syncAppointmentCount();

                var aptCfgSection = document.getElementById('ev-custom-apt-configs-section');
                if (aptCfgSection) {
                    aptCfgSection.style.display = state.packageQty > 1 ? '' : 'none';
                    if (state.packageQty > 1) renderAppointmentConfigs();
                }
                renderSummary();
            });
        });

        // Addon clicks (inside custom configurator, delegated)
        var addonsListMain = document.getElementById('ev-addons-list');
        if (addonsListMain) {
            addonsListMain.addEventListener('click', function (e) {
                handleAddonClick(e, this);
            });
        }

        // Per-appointment configs delegated events
        var aptConfigs = document.getElementById('ev-apt-configs');
        if (aptConfigs) {
            aptConfigs.addEventListener('click', function (e) {
                var toggleBtn = e.target.closest('.ev-apt-toggle-btn');
                if (toggleBtn) {
                    var aptIdx = parseInt(toggleBtn.getAttribute('data-apt'), 10);
                    var action = toggleBtn.getAttribute('data-action');
                    if (action === 'inherit') {
                        state.appointments[aptIdx].customized = false;
                    } else if (action === 'customize') {
                        if (!state.appointments[aptIdx].customized) {
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

                handleAddonClick(e, aptConfigs);
            });
        }

        // Suggestions container (step 0, delegated)
        var suggestionsContainer = document.getElementById('ev-suggestions-container');
        if (suggestionsContainer) {
            suggestionsContainer.addEventListener('click', function (e) {
                var chooseBtn = e.target.closest('.ev-suggestion-choose-btn');
                if (chooseBtn) {
                    var sugIdx = parseInt(chooseBtn.getAttribute('data-suggestion'), 10);
                    applySuggestion(sugIdx);
                    return;
                }

                var card = e.target.closest('.ev-suggestion-card');
                if (card && !e.target.closest('.ev-suggestion-choose-btn')) {
                    var cardIdx = parseInt(card.getAttribute('data-suggestion'), 10);
                    applySuggestion(cardIdx);
                    return;
                }

                if (e.target.id === 'ev-custom-btn' || e.target.closest('#ev-custom-btn')) {
                    showCustomConfigurator();
                }
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

        // Pregnancy type toggles (step 0)
        document.querySelectorAll('.ev-preg-toggle').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.ev-preg-toggle').forEach(function (b) { b.classList.remove('active'); });
                this.classList.add('active');
                state.pregType = this.getAttribute('data-preg-type');
                var wrapper = document.getElementById('ev-preg-date-wrapper');
                if (wrapper) wrapper.style.display = '';

                // Reset suggestions and sidebar
                state.selectedSuggestion = null;
                var customEl = document.getElementById('ev-custom-configurator');
                if (customEl) customEl.style.display = 'none';
                hideSuggestionsWrapper();
                hideSidebar();
                clearPregDropdownError();

                // If day/month already selected, re-calculate
                if (state.pregDay && state.pregMonth) {
                    updatePregDateFromDropdowns();
                } else {
                    renderPregnancy();
                }
            });
        });

        // Pregnancy day/month dropdown handlers (step 0)
        var pregDay = document.getElementById('ev-preg-day');
        var pregMonth = document.getElementById('ev-preg-month');
        if (pregDay) {
            pregDay.addEventListener('change', updatePregDateFromDropdowns);
            pregDay.addEventListener('input', updatePregDateFromDropdowns);
        }
        if (pregMonth) {
            pregMonth.addEventListener('change', updatePregDateFromDropdowns);
            pregMonth.addEventListener('input', updatePregDateFromDropdowns);
        }

        // Appointment date inputs (step 1, delegated)
        var datesContainer = document.getElementById('ev-dates-container');
        if (datesContainer) {
            datesContainer.addEventListener('change', function (e) {
                if (e.target.classList.contains('ev-date-input')) {
                    var idx = parseInt(e.target.getAttribute('data-idx'), 10);
                    state.appointments[idx].date = e.target.value;
                    delete state.selectedSlots[idx];
                    checkAndFetchTimeslots();
                }
            });
            datesContainer.addEventListener('click', function (e) {
                var btn = e.target.closest('.ev-date-sug-btn');
                if (!btn) return;
                var idx = parseInt(btn.getAttribute('data-idx'), 10);
                var date = btn.getAttribute('data-date');
                state.appointments[idx].date = date;
                delete state.selectedSlots[idx];
                renderDatePickers();
                checkAndFetchTimeslots();
            });
        }

        // Timeslot selection (step 1, delegated)
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
                    checkAndShowCustomerFields();
                    return;
                }

                var altBtn = e.target.closest('.ev-alt-date-btn');
                if (altBtn) {
                    var altAptIdx = parseInt(altBtn.getAttribute('data-apt'), 10);
                    var altDate = altBtn.getAttribute('data-date');
                    state.appointments[altAptIdx].date = altDate;
                    delete state.selectedSlots[altAptIdx];
                    fetchAvailableSlots();
                    return;
                }

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
