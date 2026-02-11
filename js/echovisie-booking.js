/**
 * EchoVisie Booking Widget – Interactive logic & pricing engine
 */
(function () {
    'use strict';

    /* =========================================================
       STATE
       ========================================================= */
    var state = {
        duration: 10,          // 10–60 in steps of 10
        timeSlot: 'working',   // 'working' | 'evening'
        packageQty: 1,         // 1 | 2 | 3
        addons: {}             // keyed by addon id → { qty: number }
    };

    /* =========================================================
       PRICING RULES
       ========================================================= */

    // Base price for the session (without add-ons)
    function basePriceForDuration(duration, timeSlot) {
        var startFee = timeSlot === 'working' ? 10 : 20;
        var extraBlocks = Math.max(0, (duration - 10) / 10);
        return startFee + extraBlocks * 15;
    }

    // How many free small printed photos are included
    function freeSmallPhotos(duration) {
        if (duration < 20) return 0;
        // 2 at 20 min, +2 per extra 10 min
        return 2 + Math.max(0, (duration - 20) / 10) * 2;
    }

    // Free large printed photos
    function freeLargePhotos(duration) {
        return duration >= 20 ? 1 : 0;
    }

    // Gender determination available?
    function genderAvailable(duration) {
        return duration >= 20;
    }

    // Full recording free?
    function recordingFree(duration) {
        return duration >= 40;
    }

    // USB stick free?
    function usbFree(duration) {
        return duration >= 40;
    }

    // Digital 2D images included
    function included2D(duration) {
        return (duration / 10) * 5;
    }

    // Digital 3D images included (2 per 10 min after 20 min)
    function included3D(duration) {
        if (duration < 20) return 0;
        return Math.floor(duration / 10) * 2;
    }

    // 4D videos included (1 per 10 min after 30 min)
    function included4D(duration) {
        if (duration < 30) return 0;
        return Math.floor(duration / 10) * 1;
    }

    // Package discount multiplier
    function packageDiscount(qty) {
        if (qty === 2) return 0.10;
        if (qty === 3) return 0.20;
        return 0;
    }

    /* =========================================================
       INCLUDED FEATURES (cards)
       ========================================================= */
    function buildIncludedCards(duration) {
        return [
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
            },
            {
                icon: '\uD83D\uDCF7',
                name: 'Digitale 2D-beelden',
                detail: included2D(duration) + ' beelden inbegrepen',
                free: true,
                unlockAt: 10
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
            {
                icon: '\uD83C\uDFAC',
                name: '4D-video\'s',
                detail: included4D(duration) > 0
                    ? included4D(duration) + ' video(s) inbegrepen'
                    : 'Ontgrendeld bij 30 min',
                free: included4D(duration) > 0,
                unlockAt: 30
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

            // Auto-select free items
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
                // qty stepper
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

    function calculateTotal() {
        var duration = state.duration;
        var base = basePriceForDuration(duration, state.timeSlot);
        var addonsTotal = 0;
        var addons = buildAddons(duration);

        var lines = [];
        lines.push({ label: 'Basispakket (' + duration + ' min)', amount: base });

        for (var i = 0; i < addons.length; i++) {
            var a = addons[i];
            var addonState = state.addons[a.id] || { qty: 0 };
            if (addonState.qty > 0 && a.unitPrice > 0) {
                var cost = a.unitPrice * addonState.qty;
                addonsTotal += cost;
                var qty_label = addonState.qty > 1 ? ' x' + addonState.qty : '';
                lines.push({ label: a.name + qty_label, amount: cost });
            }
        }

        var subtotal = base + addonsTotal;
        var qty = state.packageQty;
        var rawTotal = subtotal * qty;
        var disc = packageDiscount(qty);
        var discountAmount = rawTotal * disc;
        var total = rawTotal - discountAmount;

        if (qty > 1) {
            lines.push({ label: qty + 'x afspraken subtotaal', amount: rawTotal });
        }

        return { lines: lines, subtotal: subtotal, qty: qty, discount: disc, discountAmount: discountAmount, total: total };
    }

    function renderSummary() {
        var calc = calculateTotal();
        var container = document.getElementById('ev-summary');
        var totalEl = document.getElementById('ev-total-amount');
        if (!container || !totalEl) return;

        var html = '';
        for (var i = 0; i < calc.lines.length; i++) {
            var l = calc.lines[i];
            html += '<div class="ev-summary-row"><span>' + l.label + '</span><span>' + euro(l.amount) + '</span></div>';
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
        renderSummary();
    }

    /* =========================================================
       EVENT HANDLERS
       ========================================================= */
    function init() {
        var slider = document.getElementById('ev-duration-slider');
        var durationLabel = document.getElementById('ev-duration-value');

        if (!slider) return; // widget not on page

        // Slider
        slider.addEventListener('input', function () {
            state.duration = parseInt(this.value, 10);
            if (durationLabel) durationLabel.textContent = state.duration;
            // Reset auto-selected items that depend on duration
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

            // Qty stepper buttons
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

        // Book button
        document.getElementById('ev-book-btn').addEventListener('click', function () {
            var calc = calculateTotal();
            var msg = 'Bedankt voor je interesse! Je selectie:\n\n';
            msg += 'Duur: ' + state.duration + ' minuten\n';
            msg += 'Tijdstip: ' + (state.timeSlot === 'working' ? 'Werkuren' : 'Avond/Weekend') + '\n';
            msg += 'Aantal afspraken: ' + state.packageQty + '\n';
            msg += 'Totaal: ' + euro(calc.total) + '\n\n';
            msg += 'Neem contact op om je afspraak te bevestigen!';
            alert(msg);
        });

        // Initial render
        renderAll();
    }

    function resetAutoSelections() {
        // Clear auto-selections so they get re-evaluated
        var autoKeys = ['recording', 'usb'];
        var addons = buildAddons(state.duration);
        for (var i = 0; i < addons.length; i++) {
            var a = addons[i];
            if (autoKeys.indexOf(a.id) !== -1) {
                if (a.autoSelected) {
                    state.addons[a.id] = { qty: 1 };
                }
                // If it was auto-selected before but now costs money,
                // keep user's choice unless they haven't interacted
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
