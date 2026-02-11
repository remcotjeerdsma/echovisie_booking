<?php
/**
 * Plugin Name: EchoVisie Booking
 * Description: Interactive baby ultrasound booking widget with configurable duration, add-ons, and package discounts.
 * Version: 1.0.0
 * Author: EchoVisie
 * Text Domain: echovisie-booking
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'ECHOVISIE_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'ECHOVISIE_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );

/**
 * Enqueue plugin assets only when the shortcode is present.
 */
function echovisie_enqueue_assets() {
    global $post;
    if ( is_a( $post, 'WP_Post' ) && has_shortcode( $post->post_content, 'echovisie_booking' ) ) {
        wp_enqueue_style(
            'echovisie-booking-css',
            ECHOVISIE_PLUGIN_URL . 'css/echovisie-booking.css',
            array(),
            '1.0.0'
        );
        wp_enqueue_script(
            'echovisie-booking-js',
            ECHOVISIE_PLUGIN_URL . 'js/echovisie-booking.js',
            array(),
            '1.0.0',
            true
        );
    }
}
add_action( 'wp_enqueue_scripts', 'echovisie_enqueue_assets' );

/**
 * Render the booking widget via shortcode [echovisie_booking].
 */
function echovisie_booking_shortcode() {
    ob_start();
    ?>
    <div id="echovisie-booking" class="ev-booking">

        <!-- Header -->
        <div class="ev-header">
            <h2 class="ev-title">Stel jouw echo samen</h2>
            <p class="ev-subtitle">Verschuif de slider om de duur te kiezen en ontgrendel extra's</p>
        </div>

        <!-- Duration slider -->
        <div class="ev-section ev-duration-section">
            <label class="ev-label" for="ev-duration-slider">Duur van de echo</label>
            <div class="ev-slider-wrap">
                <input type="range" id="ev-duration-slider" min="10" max="60" step="10" value="10">
                <div class="ev-slider-labels" aria-hidden="true">
                    <span>10</span><span>20</span><span>30</span><span>40</span><span>50</span><span>60</span>
                </div>
            </div>
            <div class="ev-duration-display"><span id="ev-duration-value">10</span> minuten</div>
        </div>

        <!-- Time-of-day selector -->
        <div class="ev-section ev-time-section">
            <label class="ev-label">Tijdstip</label>
            <div class="ev-toggle-group">
                <button type="button" class="ev-toggle active" data-time="working">
                    <span class="ev-toggle-icon">&#9728;&#65039;</span>
                    Overdag
                    <span class="ev-toggle-discount">&euro;10 korting!</span>
                </button>
                <button type="button" class="ev-toggle" data-time="evening">
                    <span class="ev-toggle-icon">&#9790;</span>
                    Avond / Weekend
                    <span class="ev-toggle-price">standaardtarief</span>
                </button>
            </div>
        </div>

        <!-- Included features -->
        <div class="ev-section ev-included-section">
            <h3 class="ev-section-title">Inbegrepen bij jouw keuze</h3>
            <div class="ev-included-grid" id="ev-included-grid">
                <!-- Populated by JS -->
            </div>
        </div>

        <!-- Optional add-ons -->
        <div class="ev-section ev-addons-section">
            <h3 class="ev-section-title">Extra opties</h3>
            <div class="ev-addons-list" id="ev-addons-list">
                <!-- Populated by JS -->
            </div>
        </div>

        <!-- Package discount -->
        <div class="ev-section ev-package-section">
            <h3 class="ev-section-title">Afsprakenpakket</h3>
            <p class="ev-package-hint">Boek meerdere afspraken tegelijk en bespaar!</p>
            <div class="ev-package-options">
                <button type="button" class="ev-package-btn active" data-qty="1">
                    <span class="ev-package-qty">1</span>
                    <span class="ev-package-label">Enkele afspraak</span>
                </button>
                <button type="button" class="ev-package-btn" data-qty="2">
                    <span class="ev-package-qty">2</span>
                    <span class="ev-package-label">10% korting</span>
                </button>
                <button type="button" class="ev-package-btn" data-qty="3">
                    <span class="ev-package-qty">3</span>
                    <span class="ev-package-label">20% korting</span>
                </button>
            </div>
        </div>

        <!-- Pregnancy helper -->
        <div class="ev-section ev-preg-section">
            <h3 class="ev-section-title">Wanneer ben je uitgerekend?</h3>
            <p class="ev-preg-subtitle">Vul je datum in zodat we de ideale momenten voor je echo's kunnen berekenen</p>
            <div class="ev-preg-toggle-group">
                <button type="button" class="ev-preg-toggle" data-preg-type="due">Ik weet mijn uitgerekende datum</button>
                <button type="button" class="ev-preg-toggle" data-preg-type="lmp">Ik weet de eerste dag van mijn laatste menstruatie</button>
            </div>
            <div id="ev-preg-date-wrapper" class="ev-preg-date-wrapper" style="display:none">
                <input type="date" id="ev-preg-date-input" class="ev-preg-date-input">
            </div>
            <div id="ev-preg-info"></div>
        </div>

        <!-- Appointment dates -->
        <div class="ev-section ev-dates-section">
            <h3 class="ev-section-title">Kies je afspraakdatum</h3>
            <div id="ev-dates-container" class="ev-dates-container">
                <!-- Populated by JS -->
            </div>
        </div>

        <!-- Price summary -->
        <div class="ev-section ev-summary-section">
            <div class="ev-summary" id="ev-summary">
                <!-- Populated by JS -->
            </div>
            <div class="ev-total-bar">
                <span class="ev-total-label">Totaal</span>
                <span class="ev-total-amount" id="ev-total-amount">&euro;10,00</span>
            </div>
            <button type="button" class="ev-book-btn" id="ev-book-btn">Afspraak boeken</button>
        </div>

    </div>
    <?php
    return ob_get_clean();
}
add_shortcode( 'echovisie_booking', 'echovisie_booking_shortcode' );
