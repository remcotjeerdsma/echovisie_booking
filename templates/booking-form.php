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
            <span class="ev-step__num">1</span>
            <span class="ev-step__label">Zwangerschap</span>
        </div>
        <div class="ev-step__line"></div>
        <div class="ev-step" data-step="1">
            <span class="ev-step__num">2</span>
            <span class="ev-step__label">Jouw echo</span>
        </div>
        <div class="ev-step__line"></div>
        <div class="ev-step" data-step="2">
            <span class="ev-step__num">3</span>
            <span class="ev-step__label">Datum &amp; tijd</span>
        </div>
        <div class="ev-step__line"></div>
        <div class="ev-step" data-step="3">
            <span class="ev-step__num">4</span>
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
                    <div class="ev-date-field">
                        <label>Dag</label>
                        <select id="ev-day" class="ev-select">
                            <option value="">—</option>
                        </select>
                    </div>
                    <div class="ev-date-field">
                        <label>Maand</label>
                        <select id="ev-month" class="ev-select">
                            <option value="">—</option>
                        </select>
                    </div>
                </div>

                <div id="ev-preg-info" class="ev-preg-info" style="display:none;">
                    <div class="ev-preg-badge">
                        <span class="ev-preg-badge__week">—</span>
                        <span class="ev-preg-badge__label">weken zwanger</span>
                    </div>
                    <div class="ev-timeline">
                        <div class="ev-timeline__bar">
                            <div class="ev-timeline__progress" style="width:0%"></div>
                            <div class="ev-timeline__marker ev-timeline__marker--gender" data-week="16" title="Geslachtsbepaling (week 15-20)"></div>
                            <div class="ev-timeline__marker ev-timeline__marker--pretecho" data-week="28" title="3D/4D Pretecho (week 22-29)"></div>
                            <div class="ev-timeline__marker ev-timeline__marker--portrait" data-week="34" title="Portretecho (week 34)"></div>
                        </div>
                        <div class="ev-timeline__labels">
                            <span>0 wk</span>
                            <span>10 wk</span>
                            <span>20 wk</span>
                            <span>30 wk</span>
                            <span>40 wk</span>
                        </div>
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

            <!-- STEP 3: Gegevens -->
            <div class="ev-panel" data-panel="3" style="display:none;">
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
                </div>

                <div class="ev-nav">
                    <button type="button" class="ev-btn ev-btn--ghost" id="ev-back-3">&larr; Terug</button>
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
