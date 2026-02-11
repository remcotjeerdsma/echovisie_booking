<?php
/**
 * Plugin Name: EchoVisie Booking
 * Description: Interactive baby ultrasound booking widget with Bookly integration.
 * Version: 2.0.0
 * Author: EchoVisie
 * Text Domain: echovisie-booking
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'ECHOVISIE_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'ECHOVISIE_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );

/* =================================================================
   BOOKLY INTEGRATION CONFIG
   =================================================================
   Fill in the Bookly IDs after creating services, extras, and staff
   in your Bookly admin panel (Bookly → Services, Bookly → Staff).

   To find IDs: hover over items in Bookly admin, check the URL or
   use Bookly → Services → click service → look at URL for ?id=X
   ================================================================= */

function echovisie_bookly_config() {
    return array(

        /* ----------------------------------------------------------
           SERVICE MAPPING
           Map each echo duration (minutes) to a Bookly Service ID.
           Create 6 services in Bookly admin:
             "Echo 10 min" (duration: 10, price: €20)
             "Echo 20 min" (duration: 20, price: €35)
             "Echo 30 min" (duration: 30, price: €50)
             "Echo 40 min" (duration: 40, price: €65)
             "Echo 50 min" (duration: 50, price: €80)
             "Echo 60 min" (duration: 60, price: €95)
           Set the evening/weekend price as the base price.
           Use Bookly Special Hours to set daytime (€10 less).
           ---------------------------------------------------------- */
        'services' => array(
            10 => 0,  // ← Replace 0 with Bookly service ID for "Echo 10 min"
            20 => 0,  // ← Replace 0 with Bookly service ID for "Echo 20 min"
            30 => 0,  // ← Replace 0 with Bookly service ID for "Echo 30 min"
            40 => 0,  // ← Replace 0 with Bookly service ID for "Echo 40 min"
            50 => 0,  // ← Replace 0 with Bookly service ID for "Echo 50 min"
            60 => 0,  // ← Replace 0 with Bookly service ID for "Echo 60 min"
        ),

        /* ----------------------------------------------------------
           SERVICE EXTRAS MAPPING
           Map each EchoVisie add-on to a Bookly Service Extra ID.
           Create these in Bookly → Service Extras and attach them
           to all 6 echo services.
           ---------------------------------------------------------- */
        'extras' => array(
            'extra_small_photo' => 0,  // ← "Extra kleine foto (print)" €2/stuk
            'extra_large_photo' => 0,  // ← "Extra grote foto (print)" €4/stuk
            'recording'         => 0,  // ← "Volledige opname" €30 (free at 40+ min)
            'usb'               => 0,  // ← "USB-stick (16 GB)" €10 (free at 40+ min)
            // 'gender' is free/included, no Bookly extra needed
        ),

        /* ----------------------------------------------------------
           STAFF MAPPING
           Map staff names to Bookly Staff Member IDs.
           ---------------------------------------------------------- */
        'staff' => array(
            'ida'      => 0,  // ← Ida Tjeerdsma → Bookly staff ID
            'christel' => 0,  // ← Christel van den Heuvel → Bookly staff ID
            'rianne'   => 0,  // ← Rianne Block → Bookly staff ID
        ),

        /* ----------------------------------------------------------
           PACKAGE DISCOUNT COUPONS
           Create these coupons in Bookly → Coupons:
             PAKKET2: 10% discount, min 2 appointments
             PAKKET3: 20% discount, min 3 appointments
           ---------------------------------------------------------- */
        'coupons' => array(
            2 => 'PAKKET2',  // 10% package discount
            3 => 'PAKKET3',  // 20% package discount
        ),

        /* ----------------------------------------------------------
           CHECKOUT PAGE
           Create a WordPress page with the slug below and add the
           shortcode [echovisie_checkout] to it.
           ---------------------------------------------------------- */
        'checkout_page_slug' => 'echo-boeken',

        /* ----------------------------------------------------------
           CUSTOM FIELDS (Bookly Custom Fields)
           Map custom field IDs for passing pregnancy info to Bookly.
           Create these in Bookly → Custom Fields:
             "Zwangerschapsweek bij afspraak" (text)
             "Uitgerekende datum" (text)
             "Opmerkingen" (textarea)
           ---------------------------------------------------------- */
        'custom_fields' => array(
            'pregnancy_week' => 0,  // ← Bookly custom field ID
            'due_date'       => 0,  // ← Bookly custom field ID
            'notes'          => 0,  // ← Bookly custom field ID
        ),
    );
}


/* =================================================================
   ENQUEUE ASSETS
   ================================================================= */

function echovisie_enqueue_assets() {
    global $post;

    $has_configurator = is_a( $post, 'WP_Post' ) && has_shortcode( $post->post_content, 'echovisie_booking' );
    $has_checkout     = is_a( $post, 'WP_Post' ) && has_shortcode( $post->post_content, 'echovisie_checkout' );

    if ( $has_configurator || $has_checkout ) {
        wp_enqueue_style(
            'echovisie-google-fonts',
            'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap',
            array(),
            null
        );
        wp_enqueue_style(
            'echovisie-booking-css',
            ECHOVISIE_PLUGIN_URL . 'css/echovisie-booking.css',
            array( 'echovisie-google-fonts' ),
            '2.0.0'
        );
    }

    if ( $has_configurator ) {
        wp_enqueue_script(
            'echovisie-booking-js',
            ECHOVISIE_PLUGIN_URL . 'js/echovisie-booking.js',
            array(),
            '2.0.0',
            true
        );

        $config = echovisie_bookly_config();

        wp_localize_script( 'echovisie-booking-js', 'echovisieBooking', array(
            'ajaxUrl'     => admin_url( 'admin-ajax.php' ),
            'nonce'       => wp_create_nonce( 'echovisie_book' ),
            'checkoutUrl' => home_url( '/' . $config['checkout_page_slug'] . '/' ),
        ) );
    }
}
add_action( 'wp_enqueue_scripts', 'echovisie_enqueue_assets' );


/* =================================================================
   AJAX HANDLER – Receive configurator data, store, return redirect
   ================================================================= */

add_action( 'wp_ajax_echovisie_book',        'echovisie_ajax_book' );
add_action( 'wp_ajax_nopriv_echovisie_book',  'echovisie_ajax_book' );

function echovisie_ajax_book() {
    check_ajax_referer( 'echovisie_book', 'nonce' );

    $raw = isset( $_POST['config'] ) ? $_POST['config'] : '';
    $data = json_decode( wp_unslash( $raw ), true );

    if ( ! is_array( $data ) || empty( $data['appointments'] ) ) {
        wp_send_json_error( array( 'message' => 'Ongeldige configuratie.' ) );
    }

    $config = echovisie_bookly_config();

    // Sanitize and validate
    $package_qty = absint( $data['packageQty'] ?? 1 );
    if ( $package_qty < 1 || $package_qty > 3 ) {
        $package_qty = 1;
    }

    $appointments = array();
    for ( $i = 0; $i < $package_qty; $i++ ) {
        $apt = $data['appointments'][ $i ] ?? array();

        $duration  = absint( $apt['duration'] ?? 10 );
        $time_slot = sanitize_text_field( $apt['timeSlot'] ?? 'working' );
        $date      = sanitize_text_field( $apt['date'] ?? '' );

        // Validate duration is a valid step
        if ( ! in_array( $duration, array( 10, 20, 30, 40, 50, 60 ), true ) ) {
            $duration = 10;
        }

        // Map to Bookly service ID
        $service_id = $config['services'][ $duration ] ?? 0;

        // Map addons to Bookly extras
        $extras = array();
        $raw_addons = $apt['addons'] ?? array();
        foreach ( $raw_addons as $addon_id => $addon_data ) {
            $addon_id = sanitize_key( $addon_id );
            $qty = absint( $addon_data['qty'] ?? 0 );
            if ( $qty > 0 && isset( $config['extras'][ $addon_id ] ) && $config['extras'][ $addon_id ] > 0 ) {
                $extras[] = array(
                    'bookly_extra_id' => $config['extras'][ $addon_id ],
                    'quantity'        => $qty,
                );
            }
        }

        $appointments[] = array(
            'index'      => $i,
            'duration'   => $duration,
            'time_slot'  => $time_slot,
            'date'       => $date,
            'service_id' => $service_id,
            'extras'     => $extras,
        );
    }

    // Pregnancy info
    $preg_type = sanitize_text_field( $data['pregType'] ?? '' );
    $preg_date = sanitize_text_field( $data['pregDate'] ?? '' );

    // Custom fields for Bookly
    $custom_fields = array();
    if ( $preg_date ) {
        if ( $config['custom_fields']['due_date'] > 0 ) {
            $custom_fields[] = array(
                'id'    => $config['custom_fields']['due_date'],
                'value' => $preg_date,
            );
        }
    }

    // Build booking token and store in transient (expires in 2 hours)
    $token = wp_generate_password( 32, false );
    $booking_data = array(
        'package_qty'   => $package_qty,
        'appointments'  => $appointments,
        'preg_type'     => $preg_type,
        'preg_date'     => $preg_date,
        'custom_fields' => $custom_fields,
        'coupon'        => $config['coupons'][ $package_qty ] ?? '',
        'created_at'    => current_time( 'mysql' ),
    );

    set_transient( 'echovisie_booking_' . $token, $booking_data, 2 * HOUR_IN_SECONDS );

    $checkout_url = add_query_arg( 'ev_token', $token, home_url( '/' . $config['checkout_page_slug'] . '/' ) );

    wp_send_json_success( array(
        'redirect' => $checkout_url,
        'token'    => $token,
    ) );
}


/* =================================================================
   AJAX HANDLER – Fetch available timeslots from Bookly
   =================================================================
   Called by the JS configurator when the user reaches step 3.
   Queries Bookly's internal availability engine for each appointment.
   ================================================================= */

add_action( 'wp_ajax_echovisie_get_slots',        'echovisie_ajax_get_slots' );
add_action( 'wp_ajax_nopriv_echovisie_get_slots',  'echovisie_ajax_get_slots' );

function echovisie_ajax_get_slots() {
    check_ajax_referer( 'echovisie_book', 'nonce' );

    $raw = isset( $_POST['config'] ) ? $_POST['config'] : '';
    $data = json_decode( wp_unslash( $raw ), true );

    if ( ! is_array( $data ) || empty( $data['appointments'] ) ) {
        wp_send_json_error( array( 'message' => 'Ongeldige configuratie.' ) );
    }

    $config      = echovisie_bookly_config();
    $package_qty = min( 3, max( 1, absint( $data['packageQty'] ?? 1 ) ) );
    $all_slots   = array();

    for ( $i = 0; $i < $package_qty; $i++ ) {
        $apt      = $data['appointments'][ $i ] ?? array();
        $duration = absint( $apt['duration'] ?? 10 );
        $date     = sanitize_text_field( $apt['date'] ?? '' );

        if ( ! in_array( $duration, array( 10, 20, 30, 40, 50, 60 ), true ) ) {
            $duration = 10;
        }

        $service_id = $config['services'][ $duration ] ?? 0;
        $slots_for_apt = array();

        if ( $service_id > 0 && $date && class_exists( '\Bookly\Lib\Entities\Staff' ) ) {
            // Query Bookly for available slots on the given date
            $slots_for_apt = echovisie_query_bookly_slots( $service_id, $date, $duration );
        }

        $all_slots[ $i ] = $slots_for_apt;
    }

    wp_send_json_success( array( 'slots' => $all_slots ) );
}

/**
 * Query Bookly's availability for a specific service on a specific date.
 *
 * Uses Bookly's internal Schedule/Availability classes to find open slots.
 * Returns array of [ { time, staff_id, staff_name } ].
 *
 * NOTE: This uses Bookly's internal APIs which may change between versions.
 * If this stops working after a Bookly update, check the Bookly changelog
 * and update the class/method references accordingly.
 */
function echovisie_query_bookly_slots( $service_id, $date, $duration_min ) {
    $slots = array();

    try {
        // Get all staff members that offer this service
        if ( ! class_exists( '\Bookly\Lib\Entities\StaffService' ) ) {
            return $slots;
        }

        $staff_services = \Bookly\Lib\Entities\StaffService::query()
            ->where( 'service_id', $service_id )
            ->find();

        $staff_ids = array();
        foreach ( $staff_services as $ss ) {
            $staff_ids[] = $ss->getStaffId();
        }

        if ( empty( $staff_ids ) ) {
            return $slots;
        }

        // Get staff details
        $staff_members = \Bookly\Lib\Entities\Staff::query()
            ->whereIn( 'id', $staff_ids )
            ->find();

        $staff_map = array();
        foreach ( $staff_members as $staff ) {
            $staff_map[ $staff->getId() ] = $staff->getFullName();
        }

        // Query existing appointments on this date to determine availability
        $date_start = $date . ' 00:00:00';
        $date_end   = $date . ' 23:59:59';

        $existing = \Bookly\Lib\Entities\Appointment::query()
            ->whereIn( 'staff_id', $staff_ids )
            ->whereGte( 'start_date', $date_start )
            ->whereLte( 'start_date', $date_end )
            ->find();

        // Build occupied time ranges per staff
        $occupied = array();
        foreach ( $existing as $appt ) {
            $sid = $appt->getStaffId();
            if ( ! isset( $occupied[ $sid ] ) ) {
                $occupied[ $sid ] = array();
            }
            $occupied[ $sid ][] = array(
                'start' => strtotime( $appt->getStartDate() ),
                'end'   => strtotime( $appt->getEndDate() ),
            );
        }

        // Generate time slots (every 30 min from 09:00 to 20:00)
        $slot_interval = 30 * 60; // 30 minutes
        $duration_sec  = $duration_min * 60;
        $day_start     = strtotime( $date . ' 09:00:00' );
        $day_end       = strtotime( $date . ' 20:00:00' );

        for ( $time = $day_start; $time + $duration_sec <= $day_end; $time += $slot_interval ) {
            $slot_end = $time + $duration_sec;

            foreach ( $staff_ids as $sid ) {
                $is_free = true;
                $staff_bookings = $occupied[ $sid ] ?? array();

                foreach ( $staff_bookings as $booking ) {
                    // Check for overlap
                    if ( $time < $booking['end'] && $slot_end > $booking['start'] ) {
                        $is_free = false;
                        break;
                    }
                }

                if ( $is_free ) {
                    $slots[] = array(
                        'time'       => date( 'H:i', $time ),
                        'staff_id'   => $sid,
                        'staff_name' => $staff_map[ $sid ] ?? 'Medewerker',
                    );
                }
            }
        }
    } catch ( \Exception $e ) {
        // If Bookly classes are unavailable or incompatible, return empty
        return array();
    }

    return $slots;
}


/* =================================================================
   CHECKOUT SHORTCODE – [echovisie_checkout]
   Renders the booking summary + Bookly forms for slot selection.
   Place this shortcode on a page with slug matching checkout_page_slug.
   ================================================================= */

add_shortcode( 'echovisie_checkout', 'echovisie_checkout_shortcode' );

function echovisie_checkout_shortcode() {
    $token = isset( $_GET['ev_token'] ) ? sanitize_text_field( $_GET['ev_token'] ) : '';

    if ( ! $token ) {
        return '<div class="ev-booking-wrapper"><div class="ev-booking"><div class="ev-section" style="text-align:center;padding:3rem 1.5rem;">'
             . '<h3 class="ev-section-title">Geen configuratie gevonden</h3>'
             . '<p>Ga terug naar de <a href="' . esc_url( home_url() ) . '">configurator</a> om je echo samen te stellen.</p>'
             . '</div></div></div>';
    }

    $booking = get_transient( 'echovisie_booking_' . $token );
    if ( ! $booking ) {
        return '<div class="ev-booking-wrapper"><div class="ev-booking"><div class="ev-section" style="text-align:center;padding:3rem 1.5rem;">'
             . '<h3 class="ev-section-title">Sessie verlopen</h3>'
             . '<p>Je configuratie is verlopen. Ga terug naar de <a href="' . esc_url( home_url() ) . '">configurator</a> om opnieuw te beginnen.</p>'
             . '</div></div></div>';
    }

    $config      = echovisie_bookly_config();
    $appointments = $booking['appointments'];
    $package_qty  = $booking['package_qty'];
    $coupon       = $booking['coupon'];

    // Pricing helpers (mirror JS logic)
    $daytime_discount = 10;
    $time_labels = array( 'working' => 'Overdag', 'evening' => 'Avond / Weekend' );

    ob_start();
    ?>
    <div class="ev-booking-wrapper">
        <div class="ev-booking">

            <div class="ev-header">
                <h2 class="ev-title">Jouw echo-configuratie</h2>
                <p class="ev-subtitle">Controleer je selectie en kies een beschikbaar tijdstip</p>
            </div>

            <!-- Appointment summary cards -->
            <?php foreach ( $appointments as $apt ) :
                $label = $package_qty > 1
                    ? 'Afspraak ' . ( $apt['index'] + 1 )
                    : 'Jouw echo';
                $time_label = $time_labels[ $apt['time_slot'] ] ?? $apt['time_slot'];
                $preferred_date = $apt['date']
                    ? date_i18n( 'j F Y', strtotime( $apt['date'] ) )
                    : 'Nog niet gekozen';
            ?>
            <div class="ev-section">
                <div class="ev-apt-card">
                    <div class="ev-apt-card-header">
                        <span class="ev-apt-card-number"><?php echo esc_html( $apt['index'] + 1 ); ?></span>
                        <span class="ev-apt-card-title"><?php echo esc_html( $label ); ?></span>
                        <span class="ev-apt-card-summary">
                            <?php echo esc_html( $apt['duration'] ); ?> min &middot;
                            <?php echo esc_html( $time_label ); ?>
                        </span>
                    </div>
                    <div class="ev-apt-mini-config">
                        <p style="margin:.4rem 0;font-size:.88rem;">
                            <strong>Gewenste datum:</strong> <?php echo esc_html( $preferred_date ); ?>
                        </p>
                        <?php if ( ! empty( $apt['extras'] ) ) : ?>
                        <p style="margin:.4rem 0;font-size:.85rem;color:var(--ev-text-muted);">
                            <strong>Extra's:</strong>
                            <?php echo esc_html( count( $apt['extras'] ) ); ?> optie(s) geselecteerd
                        </p>
                        <?php endif; ?>
                    </div>
                </div>

                <?php
                // Render Bookly form for this appointment, pre-selecting the service
                if ( $apt['service_id'] > 0 && shortcode_exists( 'bookly-form' ) ) :
                    // Hide service/category selection since we pre-selected it
                    // Show date, time, details, payment steps
                    $bookly_atts = 'service_id="' . absint( $apt['service_id'] ) . '"';
                    $bookly_atts .= ' hide="categories,services"';

                    // Pre-select date if available
                    if ( $apt['date'] ) {
                        $bookly_atts .= ' date="' . esc_attr( $apt['date'] ) . '"';
                    }
                ?>
                <div class="ev-bookly-form-wrap" style="margin-top:1rem;">
                    <h4 style="font-size:.92rem;font-weight:600;color:var(--ev-primary-dark);margin-bottom:.5rem;">
                        Kies een beschikbaar tijdstip
                    </h4>
                    <?php echo do_shortcode( '[bookly-form ' . $bookly_atts . ']' ); ?>
                </div>
                <?php elseif ( $apt['service_id'] === 0 ) : ?>
                <div class="ev-preg-error" style="margin-top:.8rem;">
                    <strong>Let op:</strong> De Bookly-koppeling is nog niet geconfigureerd.
                    Stel de service-ID's in via <code>echovisie_bookly_config()</code> in
                    <code>echovisie-booking.php</code>.
                </div>
                <?php endif; ?>
            </div>
            <?php endforeach; ?>

            <?php if ( $coupon && $package_qty > 1 ) : ?>
            <div class="ev-section" style="text-align:center;">
                <div style="background:var(--ev-primary-light);border-radius:10px;padding:.8rem 1rem;display:inline-block;">
                    <span style="font-size:.88rem;font-weight:600;color:var(--ev-primary-dark);">
                        Pakketkorting: gebruik code
                        <strong style="background:var(--ev-primary);color:#fff;padding:.2rem .6rem;border-radius:6px;margin-left:.3rem;">
                            <?php echo esc_html( $coupon ); ?>
                        </strong>
                        bij het afrekenen
                    </span>
                </div>
            </div>
            <?php endif; ?>

            <?php if ( $booking['preg_date'] ) : ?>
            <div class="ev-section" style="font-size:.85rem;color:var(--ev-text-muted);">
                <strong>Zwangerschapsinfo:</strong>
                <?php
                if ( $booking['preg_type'] === 'due' ) {
                    echo 'Uitgerekende datum: ' . esc_html( date_i18n( 'j F Y', strtotime( $booking['preg_date'] ) ) );
                } else {
                    echo 'Eerste dag laatste menstruatie: ' . esc_html( date_i18n( 'j F Y', strtotime( $booking['preg_date'] ) ) );
                }
                ?>
            </div>
            <?php endif; ?>

            <div class="ev-step-nav">
                <a href="javascript:history.back()" class="ev-step-prev-btn">&larr; Terug naar configurator</a>
                <span></span>
            </div>

        </div>
    </div>
    <?php
    return ob_get_clean();
}


/* =================================================================
   BOOKLY CART HELPER (for programmatic cart population)
   =================================================================
   This function attempts to pre-populate Bookly's cart with the
   appointments from the EchoVisie configurator. Call this from
   the checkout page if you want seamless cart integration.

   NOTE: This uses Bookly's internal classes which are not part of
   their public API. Test thoroughly after Bookly updates.
   ================================================================= */

function echovisie_populate_bookly_cart( $booking_data ) {
    // Check if Bookly classes are available
    if ( ! class_exists( '\Bookly\Lib\Entities\Service' ) ) {
        return false;
    }

    $config = echovisie_bookly_config();
    $items = array();

    foreach ( $booking_data['appointments'] as $apt ) {
        $service_id = $apt['service_id'];
        if ( $service_id <= 0 ) {
            continue;
        }

        // Build extras array in Bookly format: [ extra_id => quantity ]
        $extras = array();
        foreach ( $apt['extras'] as $extra ) {
            if ( $extra['bookly_extra_id'] > 0 ) {
                $extras[ $extra['bookly_extra_id'] ] = $extra['quantity'];
            }
        }

        // Build custom fields array
        $custom_fields = $booking_data['custom_fields'] ?? array();

        $items[] = array(
            'service_id'    => $service_id,
            'staff_ids'     => array(), // empty = any available staff
            'date_from'     => $apt['date'] ?: null,
            'extras'        => $extras,
            'custom_fields' => $custom_fields,
            'number_of_persons' => 1,
        );
    }

    // Store in session for Bookly to pick up
    if ( ! session_id() ) {
        session_start();
    }
    $_SESSION['echovisie_bookly_cart_items'] = $items;
    $_SESSION['echovisie_bookly_coupon']     = $booking_data['coupon'] ?? '';

    return true;
}


/* =================================================================
   BOOKLY SERVICE EXTRAS HELPER
   =================================================================
   When Bookly loads a service, this filter can inject the selected
   extras from the EchoVisie configurator. Hook into Bookly's
   appointment creation to pass extras along.
   ================================================================= */

add_action( 'bookly_appointment_status_changed', 'echovisie_on_bookly_appointment', 10, 3 );

function echovisie_on_bookly_appointment( $appointment, $status, $old_status ) {
    // This hook fires when a Bookly appointment status changes.
    // You can use this to sync data back to your system,
    // send custom notifications, or update external CRMs.
}


/* =================================================================
   CONFIGURATOR SHORTCODE – [echovisie_booking]
   ================================================================= */

function echovisie_booking_shortcode() {
    ob_start();
    ?>
    <div class="ev-booking-wrapper">
        <div id="echovisie-booking" class="ev-booking">

            <!-- Header -->
            <div class="ev-header">
                <h2 class="ev-title">Stel jouw echo samen</h2>
                <p class="ev-subtitle">Configureer je echo in een paar eenvoudige stappen</p>
            </div>

            <!-- Step bar -->
            <div class="ev-step-bar-wrap">
                <div class="ev-step-bar" id="ev-step-bar"></div>
            </div>

            <!-- ============ STEP 0: Samenstellen ============ -->
            <div class="ev-step-panel" data-step="0">

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
                    <div class="ev-included-grid" id="ev-included-grid"></div>
                </div>

                <!-- Optional add-ons -->
                <div class="ev-section ev-addons-section">
                    <h3 class="ev-section-title">Extra opties</h3>
                    <div class="ev-addons-list" id="ev-addons-list"></div>
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
                            <span class="ev-package-label">Afspraken</span>
                            <span class="ev-package-discount">&minus;10%</span>
                        </button>
                        <button type="button" class="ev-package-btn" data-qty="3">
                            <span class="ev-package-qty">3</span>
                            <span class="ev-package-label">Afspraken</span>
                            <span class="ev-package-discount">&minus;20%</span>
                        </button>
                    </div>
                </div>

            </div>

            <!-- ============ STEP 1: Afspraken ============ -->
            <div class="ev-step-panel" data-step="1" style="display:none">

                <div class="ev-section">
                    <h3 class="ev-section-title">Jouw afspraken</h3>
                    <p class="ev-package-hint">Controleer en pas eventueel individuele afspraken aan</p>
                    <div id="ev-apt-configs"></div>
                </div>

            </div>

            <!-- ============ STEP 2: Planning ============ -->
            <div class="ev-step-panel" data-step="2" style="display:none">

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
                    <div id="ev-dates-container" class="ev-dates-container"></div>
                </div>

            </div>

            <!-- ============ STEP 3: Tijdslot ============ -->
            <div class="ev-step-panel" data-step="3" style="display:none">

                <div class="ev-section">
                    <h3 class="ev-section-title">Kies een tijdslot</h3>
                    <p class="ev-package-hint">Selecteer een beschikbaar moment bij een van onze echoscopisten</p>
                    <div id="ev-timeslots-container"></div>
                </div>

            </div>

            <!-- Step navigation -->
            <div class="ev-step-nav" id="ev-step-nav"></div>

        </div>

        <!-- Sticky price sidebar -->
        <div class="ev-sidebar">
            <div class="ev-sidebar-inner">
                <h3 class="ev-sidebar-title">Prijsoverzicht</h3>
                <div class="ev-summary" id="ev-summary"></div>
                <div class="ev-total-bar">
                    <span class="ev-total-label">Totaal</span>
                    <span class="ev-total-amount" id="ev-total-amount">&euro;10,00</span>
                </div>
                <button type="button" class="ev-book-btn" id="ev-book-btn">Afspraak boeken</button>
            </div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode( 'echovisie_booking', 'echovisie_booking_shortcode' );
