<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div id="ev-booking" class="ev-booking-wrapper">

    <!-- Header -->
    <div class="ev-header">
        <h1>Jouw echo-moment plannen</h1>
        <p>Plan in een paar stappen jouw pretecho bij EchoVisie</p>
    </div>

    <!-- Step bar -->
    <div class="ev-steps">
        <div class="ev-step ev-step--active" data-step="0">
            <span class="ev-step__num">
                <!-- Heart / pregnancy -->
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </span>
            <span class="ev-step__label">Zwangerschap</span>
        </div>
        <div class="ev-step__line"></div>
        <div class="ev-step" data-step="1">
            <span class="ev-step__num">
                <!-- Ultrasound waves -->
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/><path d="M8 8a6 6 0 0 0 0 8M16 8a6 6 0 0 1 0 8M4.5 4.5a11 11 0 0 0 0 15M19.5 4.5a11 11 0 0 1 0 15"/></svg>
            </span>
            <span class="ev-step__label">Jouw echo</span>
        </div>
        <div class="ev-step__line"></div>
        <div class="ev-step" data-step="2">
            <span class="ev-step__num">
                <!-- Calendar -->
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M20 3h-1V1h-2v2H7V1H5v2H4C2.9 3 2 3.9 2 5v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z"/><path d="M9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>
            </span>
            <span class="ev-step__label">Datum &amp; tijd</span>
        </div>
        <div class="ev-step__line"></div>
        <div class="ev-step" data-step="3">
            <span class="ev-step__num">
                <!-- Sparkle / extras -->
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-5.91L4 10l5.91-1.74L12 2zM5 20l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1zM19 4l.75 2.25L22 7l-2.25.75L19 10l-.75-2.25L16 7l2.25-.75L19 4z"/></svg>
            </span>
            <span class="ev-step__label">Extra's</span>
        </div>
        <div class="ev-step__line"></div>
        <div class="ev-step" data-step="4">
            <span class="ev-step__num">
                <!-- Person / contact -->
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
            </span>
            <span class="ev-step__label">Gegevens</span>
        </div>
    </div>

    <div class="ev-body">
        <!-- Main form area -->
        <div class="ev-main">

            <!-- STEP 0: Zwangerschap -->
            <div class="ev-panel" data-panel="0">
                <h2>Wanneer ben je uitgerekend?</h2>
                <p class="ev-subtitle">Vul je uitgerekende datum of je laatste menstruatiedatum in, zodat we de beste echo voor jou kunnen voorstellen.</p>

                <div class="ev-date-type-toggle">
                    <button type="button" class="ev-toggle-btn ev-toggle-btn--active" data-type="due">Uitgerekende datum</button>
                    <button type="button" class="ev-toggle-btn" data-type="lmp">Laatste menstruatie</button>
                </div>

                <div class="ev-date-input">
                    <div class="ev-date-field ev-date-field--day">
                        <label for="ev-day-input">Dag</label>
                        <input type="number" id="ev-day-input" class="ev-input ev-day-input"
                               min="1" max="31" placeholder="1 – 31" autocomplete="off">
                    </div>
                    <div class="ev-date-field ev-date-field--month">
                        <label>Maand</label>
                        <div class="ev-month-grid" id="ev-month-grid"></div>
                    </div>
                </div>

                <div id="ev-preg-info" class="ev-preg-info">
                    <div class="ev-preg-badge">
                        <span class="ev-preg-badge__week">—</span>
                        <span class="ev-preg-badge__label">weken zwanger</span>
                    </div>
                    <div class="ev-timeline">
                        <div class="ev-timeline__bar" id="ev-timeline-bar"
                             role="slider" aria-label="Zwangerschapsweek"
                             aria-valuemin="0" aria-valuemax="42" aria-valuenow="0"
                             tabindex="0">
                            <div class="ev-timeline__progress" style="width:0%"></div>
                            <div class="ev-timeline__marker ev-timeline__marker--gender" data-week="16" title="Geslachtsbepaling (week 15-20)"></div>
                            <div class="ev-timeline__marker ev-timeline__marker--pretecho" data-week="28" title="3D/4D Pretecho (week 22-29)"></div>
                            <div class="ev-timeline__marker ev-timeline__marker--portrait" data-week="34" title="Portretecho (week 34)"></div>
                            <div class="ev-timeline__thumb" id="ev-timeline-thumb" style="display:none;"></div>
                        </div>
                        <div class="ev-timeline__labels">
                            <span>0 wk</span>
                            <span>10 wk</span>
                            <span>20 wk</span>
                            <span>30 wk</span>
                            <span>40 wk</span>
                        </div>
                        <div class="ev-timeline__hint">Sleep de balk om je zwangerschapsweek in te stellen</div>
                    </div>
                </div>

                <div class="ev-nav">
                    <button type="button" class="ev-btn ev-btn--link" id="ev-skip-pregnancy">Sla over &rarr;</button>
                    <button type="button" class="ev-btn ev-btn--primary" id="ev-next-0" disabled>Volgende</button>
                </div>
            </div>

            <!-- STEP 1: Kies je echo -->
            <div class="ev-panel" data-panel="1" style="display:none;">
                <h2>Kies je echo</h2>
                <p class="ev-subtitle" id="ev-suggestion-intro"></p>

                <!-- Suggestions (dynamically filled by JS) -->
                <div id="ev-suggestions" class="ev-suggestions"></div>

                <div class="ev-divider">
                    <span>of</span>
                </div>

                <button type="button" class="ev-btn ev-btn--outline" id="ev-custom-btn">Stel zelf samen</button>

                <!-- Custom echo builder (hidden by default) -->
                <div id="ev-custom-builder" class="ev-custom-builder" style="display:none;">
                    <div id="ev-appointments-config"></div>

                    <div id="ev-package-selector" class="ev-package-selector" style="display:none;">
                        <h3>Aantal echo's</h3>
                        <div class="ev-package-options">
                            <button type="button" class="ev-pkg-btn ev-pkg-btn--active" data-qty="1">1 echo</button>
                            <button type="button" class="ev-pkg-btn" data-qty="2">2 echo's <span class="ev-badge">10% korting</span></button>
                            <button type="button" class="ev-pkg-btn" data-qty="3">3 echo's <span class="ev-badge ev-badge--hot">20% korting</span></button>
                        </div>
                    </div>
                </div>

                <div class="ev-nav">
                    <button type="button" class="ev-btn ev-btn--ghost" id="ev-back-1">&larr; Terug</button>
                    <button type="button" class="ev-btn ev-btn--primary" id="ev-next-1" disabled>Volgende</button>
                </div>
            </div>

            <!-- STEP 2: Datum & tijd -->
            <div class="ev-panel" data-panel="2" style="display:none;">
                <h2>Kies datum en tijd</h2>
                <p class="ev-subtitle">Selecteer een datum en tijdstip voor elke echo.</p>

                <div id="ev-datetime-panels"></div>

                <div class="ev-nav">
                    <button type="button" class="ev-btn ev-btn--ghost" id="ev-back-2">&larr; Terug</button>
                    <button type="button" class="ev-btn ev-btn--primary" id="ev-next-2" disabled>Volgende</button>
                </div>
            </div>

            <!-- STEP 3: Extra's -->
            <div class="ev-panel" data-panel="3" style="display:none;">
                <h2>Extra opties</h2>
                <p class="ev-subtitle">Voeg optionele extra's toe aan jouw echo. Alles is ook zonder extra's geweldig!</p>

                <div id="ev-extras-panels"></div>

                <div class="ev-nav">
                    <button type="button" class="ev-btn ev-btn--ghost" id="ev-back-3">&larr; Terug</button>
                    <button type="button" class="ev-btn ev-btn--primary" id="ev-next-3">Volgende</button>
                </div>
            </div>

            <!-- STEP 4: Gegevens -->
            <div class="ev-panel" data-panel="4" style="display:none;">
                <h2>Jouw gegevens</h2>
                <p class="ev-subtitle">Vul je contactgegevens in om de afspraak te bevestigen.</p>

                <div class="ev-form-grid">
                    <div class="ev-form-field">
                        <label for="ev-fname">Voornaam *</label>
                        <input type="text" id="ev-fname" class="ev-input" required>
                    </div>
                    <div class="ev-form-field">
                        <label for="ev-lname">Achternaam</label>
                        <input type="text" id="ev-lname" class="ev-input">
                    </div>
                    <div class="ev-form-field">
                        <label for="ev-email">E-mailadres *</label>
                        <input type="email" id="ev-email" class="ev-input" required>
                    </div>
                    <div class="ev-form-field">
                        <label for="ev-phone">Telefoonnummer *</label>
                        <input type="tel" id="ev-phone" class="ev-input" required>
                    </div>
                    <div class="ev-form-field ev-form-field--full">
                        <label for="ev-notes">Opmerkingen</label>
                        <textarea id="ev-notes" class="ev-input ev-textarea" rows="3"></textarea>
                    </div>
                    <div class="ev-form-field ev-form-field--full">
                        <label for="ev-voucher">Kortingscode (optioneel)</label>
                        <div class="ev-voucher-row">
                            <input type="text" id="ev-voucher" class="ev-input" placeholder="Vul je code in">
                            <button type="button" class="ev-btn ev-btn--outline" id="ev-apply-voucher">Toepassen</button>
                        </div>
                        <div id="ev-voucher-result" class="ev-voucher-result"></div>
                    </div>
                </div>

                <div class="ev-nav">
                    <button type="button" class="ev-btn ev-btn--ghost" id="ev-back-4">&larr; Terug</button>
                    <button type="button" class="ev-btn ev-btn--primary ev-btn--large" id="ev-submit">Afspraak bevestigen</button>
                </div>
            </div>

            <!-- Success screen -->
            <div class="ev-panel ev-panel--success" data-panel="success" style="display:none;">
                <div class="ev-success-icon">&#10003;</div>
                <h2>Je afspraak is bevestigd!</h2>
                <p class="ev-subtitle">Je ontvangt een bevestiging per e-mail.</p>
                <div id="ev-confirmation-details"></div>
            </div>

            <!-- Payment redirect screen -->
            <div class="ev-panel ev-panel--payment" data-panel="payment" style="display:none;">
                <div class="ev-payment-spinner"></div>
                <h2>Je wordt doorgestuurd naar de betaalpagina&hellip;</h2>
                <p class="ev-subtitle">Wacht even, je wordt zo doorgestuurd naar Mollie om de betaling af te ronden.</p>
            </div>

            <!-- Payment pending screen -->
            <div class="ev-panel ev-panel--pending" data-panel="pending" style="display:none;">
                <div class="ev-pending-icon">&#8987;</div>
                <h2>Betaling in behandeling</h2>
                <p class="ev-subtitle">Je betaling wordt nog verwerkt. Je ontvangt een bevestiging per e-mail zodra de betaling is afgerond.</p>
            </div>

            <!-- Payment failed screen -->
            <div class="ev-panel ev-panel--failed" data-panel="failed" style="display:none;">
                <div class="ev-failed-icon">&#10005;</div>
                <h2>Betaling mislukt</h2>
                <p class="ev-subtitle">De betaling is niet gelukt. Probeer het opnieuw of neem contact met ons op.</p>
                <div class="ev-nav ev-nav--center">
                    <button type="button" class="ev-btn ev-btn--primary" onclick="window.location.href=window.location.pathname">Opnieuw proberen</button>
                </div>
            </div>

        </div>

        <!-- Sidebar -->
        <div class="ev-sidebar" id="ev-sidebar">
            <div class="ev-sidebar__inner">
                <h3 class="ev-sidebar__title">Samenvatting</h3>
                <div id="ev-sidebar-content" class="ev-sidebar__content">
                    <p class="ev-sidebar__empty">Stel je echo samen om de prijs te zien.</p>
                </div>
                <div class="ev-sidebar__total" id="ev-sidebar-total" style="display:none;">
                    <div class="ev-sidebar__total-row">
                        <span>Totaal</span>
                        <span id="ev-total-price" class="ev-price">&euro; 0,00</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

</div>
