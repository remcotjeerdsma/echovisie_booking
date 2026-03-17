<?php
/**
 * Plugin Name: EchoVisie Booking
 * Description: Visueel boekingsformulier voor pretecho-afspraken, geïntegreerd met Bookly Pro.
 * Version: 3.2.0
 * Author: EchoVisie
 * Text Domain: echovisie-booking
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'ECHOVISIE_VERSION', '3.2.0' );
define( 'ECHOVISIE_PATH', plugin_dir_path( __FILE__ ) );
define( 'ECHOVISIE_URL', plugin_dir_url( __FILE__ ) );

/* ── Includes ─────────────────────────────────────────── */
require_once ECHOVISIE_PATH . 'includes/class-echovisie-pricing.php';
require_once ECHOVISIE_PATH . 'includes/class-echovisie-mollie.php';
require_once ECHOVISIE_PATH . 'includes/class-echovisie-ajax.php';

if ( is_admin() ) {
    require_once ECHOVISIE_PATH . 'includes/class-echovisie-admin.php';
}

/* ── Defaults on activation ───────────────────────────── */
register_activation_hook( __FILE__, 'echovisie_activate' );

function echovisie_activate() {
    if ( get_option( 'echovisie_settings' ) === false ) {
        update_option( 'echovisie_settings', echovisie_default_settings() );
    }
}

function echovisie_default_settings() {
    return array(
        // Pricing
        'base_price'                => 9,
        'price_per_block'           => 15,
        'surcharge_amount'          => 10,
        'price_3d_extra'            => 15,
        'price_usb'                 => 10,
        'price_recording'           => 30,
        'price_extra_a4'            => 4,
        'price_extra_10x15'         => 2,

        // Content rules per duration
        'content_10_2d' => 3, 'content_10_3d' => 0, 'content_10_2d_video' => 0, 'content_10_4d_video' => 0, 'content_10_a4' => 0, 'content_10_10x15' => 0, 'content_10_usb_free' => 0, 'content_10_recording_free' => 0,
        'content_20_2d' => 8, 'content_20_3d' => 0, 'content_20_2d_video' => 0, 'content_20_4d_video' => 0, 'content_20_a4' => 1, 'content_20_10x15' => 1, 'content_20_usb_free' => 0, 'content_20_recording_free' => 0,
        'content_30_2d' => 20, 'content_30_3d' => 10, 'content_30_2d_video' => 2, 'content_30_4d_video' => 2, 'content_30_a4' => 1, 'content_30_10x15' => 2, 'content_30_usb_free' => 0, 'content_30_recording_free' => 0,
        'content_40_2d' => 20, 'content_40_3d' => 20, 'content_40_2d_video' => 2, 'content_40_4d_video' => 2, 'content_40_a4' => 1, 'content_40_10x15' => 4, 'content_40_usb_free' => 1, 'content_40_recording_free' => 1,
        'content_50_2d' => 20, 'content_50_3d' => 20, 'content_50_2d_video' => 2, 'content_50_4d_video' => 2, 'content_50_a4' => 2, 'content_50_10x15' => 4, 'content_50_usb_free' => 1, 'content_50_recording_free' => 1,
        // Bookly service IDs
        'service_id_10' => '', 'service_id_20' => '', 'service_id_30' => '',
        'service_id_40' => '', 'service_id_50' => '',

        // Staff
        'staff_1_name' => 'Medewerker 1', 'staff_1_id' => '',
        'staff_2_name' => 'Medewerker 2', 'staff_2_id' => '',
        'staff_3_name' => 'Medewerker 3', 'staff_3_id' => '',

        // Custom fields
        'cf_pregnancy_week' => '', 'cf_due_date' => '', 'cf_notes' => '',

        // Coupons
        'coupon_2pack' => '', 'coupon_3pack' => '',

        // Mollie payment
        'mollie_enabled'  => 0,
        'mollie_api_key'  => '',
        'mollie_currency' => 'EUR',
    );
}

/* ── Assets ───────────────────────────────────────────── */
add_action( 'wp_enqueue_scripts', 'echovisie_enqueue_assets' );

function echovisie_enqueue_assets() {
    global $post;
    if ( ! is_a( $post, 'WP_Post' ) || ! has_shortcode( $post->post_content, 'echovisie_booking' ) ) {
        return;
    }

    wp_enqueue_style(
        'echovisie-fonts',
        'https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,300;0,400;0,500;0,600;0,700;1,500&display=swap',
        array(),
        null
    );

    wp_enqueue_style(
        'echovisie-booking-css',
        ECHOVISIE_URL . 'assets/css/echovisie-booking.css',
        array(),
        ECHOVISIE_VERSION
    );

    wp_enqueue_script(
        'echovisie-booking-js',
        ECHOVISIE_URL . 'assets/js/echovisie-booking.js',
        array(),
        ECHOVISIE_VERSION,
        true
    );

    $s = get_option( 'echovisie_settings', echovisie_default_settings() );

    // Check for Mollie payment return
    $payment_return = null;
    if ( ! empty( $_GET['ev_token'] ) && ( sanitize_key( $_GET['ev_status'] ?? '' ) === 'return' ) ) {
        $token   = sanitize_text_field( $_GET['ev_token'] );
        $booking = get_transient( 'echovisie_pay_' . $token );
        if ( $booking ) {
            $status = $booking['status'] ?? 'pending';
            // Refresh status from Mollie if we have an API key + payment ID
            if ( ! empty( $s['mollie_api_key'] ) && ! empty( $booking['mollie_payment_id'] ) ) {
                try {
                    $mollie  = new EchoVisie_Mollie( $s['mollie_api_key'] );
                    $payment = $mollie->get_payment( $booking['mollie_payment_id'] );
                    $status  = EchoVisie_Mollie::is_paid( $payment )
                        ? 'paid'
                        : ( EchoVisie_Mollie::is_pending( $payment ) ? 'pending' : 'failed' );
                    $booking['status'] = $status;
                    set_transient( 'echovisie_pay_' . $token, $booking, DAY_IN_SECONDS );
                } catch ( \Exception $e ) {
                    // Keep stored status
                }
            }
            $payment_return = array(
                'status'       => $status,
                'appointments' => $booking['appointments'] ?? array(),
                'total'        => $booking['total'] ?? 0,
                'customer'     => $booking['customer'] ?? array(),
            );
        }
    }

    // Build content rules map for JS
    $content_rules = array();
    foreach ( array( 10, 20, 30, 40, 50 ) as $dur ) {
        $content_rules[ $dur ] = array(
            'photos_2d'      => intval( $s[ "content_{$dur}_2d" ] ?? 0 ),
            'photos_3d'      => intval( $s[ "content_{$dur}_3d" ] ?? 0 ),
            'videos_2d'      => intval( $s[ "content_{$dur}_2d_video" ] ?? 0 ),
            'videos_4d'      => intval( $s[ "content_{$dur}_4d_video" ] ?? 0 ),
            'prints_a4'      => intval( $s[ "content_{$dur}_a4" ] ?? 0 ),
            'prints_10x15'   => intval( $s[ "content_{$dur}_10x15" ] ?? 0 ),
            'usb_free'       => intval( $s[ "content_{$dur}_usb_free" ] ?? 0 ),
            'recording_free' => intval( $s[ "content_{$dur}_recording_free" ] ?? 0 ),
        );
    }

    // Build staff array
    $staff = array();
    for ( $i = 1; $i <= 3; $i++ ) {
        $id = $s[ "staff_{$i}_id" ] ?? '';
        if ( $id !== '' ) {
            $staff[] = array(
                'id'   => intval( $id ),
                'name' => sanitize_text_field( $s[ "staff_{$i}_name" ] ?? "Medewerker {$i}" ),
            );
        }
    }

    // Build service ID map
    $services = array();
    foreach ( array( 10, 20, 30, 40, 50 ) as $dur ) {
        $sid = $s[ "service_id_{$dur}" ] ?? '';
        if ( $sid !== '' ) {
            $services[ $dur ] = intval( $sid );
        }
    }

    wp_localize_script( 'echovisie-booking-js', 'echovisieBooking', array(
        'ajaxUrl'       => admin_url( 'admin-ajax.php' ),
        'nonce'         => wp_create_nonce( 'echovisie_nonce' ),
        'pageUrl'       => get_permalink(),
        'paymentReturn' => $payment_return,
        'pricing' => array(
            'basePrice'        => floatval( $s['base_price'] ?? 9 ),
            'pricePerBlock'    => floatval( $s['price_per_block'] ?? 15 ),
            'surchargeAmount'  => floatval( $s['surcharge_amount'] ?? 10 ),
            'price3dExtra'     => floatval( $s['price_3d_extra'] ?? 15 ),
            'priceUsb'         => floatval( $s['price_usb'] ?? 10 ),
            'priceRecording'   => floatval( $s['price_recording'] ?? 30 ),
            'priceExtraA4'       => floatval( $s['price_extra_a4'] ?? 4 ),
            'priceExtra10x15'    => floatval( $s['price_extra_10x15'] ?? 2 ),
            'priceConfettiKanon' => floatval( $s['price_confetti_kanon'] ?? 15 ),
        ),
        'contentRules' => $content_rules,
        'staff'        => $staff,
        'services'     => $services,
    ) );
}

/* ── Shortcode ────────────────────────────────────────── */
add_shortcode( 'echovisie_booking', 'echovisie_booking_shortcode' );

function echovisie_booking_shortcode() {
    ob_start();
    include ECHOVISIE_PATH . 'templates/booking-form.php';
    return ob_get_clean();
}
