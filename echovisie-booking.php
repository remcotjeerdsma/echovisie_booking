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

/* Load admin settings page */
if ( is_admin() ) {
    require_once ECHOVISIE_PLUGIN_DIR . 'admin/echovisie-admin.php';
}

/* =================================================================
   BOOKLY INTEGRATION CONFIG
   =================================================================
   Reads all settings from the WordPress admin page (EchoVisie menu).
   Configure via: WP Admin → EchoVisie → Instellingen
   ================================================================= */

function echovisie_bookly_config() {
    $s = get_option( 'echovisie_settings', array() );

    // Helper to read an int setting with fallback 0
    $int = function ( $key ) use ( $s ) {
        return isset( $s[ $key ] ) ? absint( $s[ $key ] ) : 0;
    };

    // Helper to read a string setting with fallback
    $str = function ( $key, $default = '' ) use ( $s ) {
        return isset( $s[ $key ] ) ? $s[ $key ] : $default;
    };

    return array(
        'services' => array(
            10 => $int( 'service_10' ),
            20 => $int( 'service_20' ),
            30 => $int( 'service_30' ),
            40 => $int( 'service_40' ),
            50 => $int( 'service_50' ),
            60 => $int( 'service_60' ),
        ),
        'extras' => array(
            'extra_small_photo' => $int( 'extra_extra_small_photo' ),
            'extra_large_photo' => $int( 'extra_extra_large_photo' ),
            'recording'         => $int( 'extra_recording' ),
            'usb'               => $int( 'extra_usb' ),
        ),
        'staff' => array(
            'ida'      => $int( 'staff_ida' ),
            'christel' => $int( 'staff_christel' ),
            'rianne'   => $int( 'staff_rianne' ),
        ),
        'coupons' => array(
            2 => $str( 'coupon_2', 'PAKKET2' ),
            3 => $str( 'coupon_3', 'PAKKET3' ),
        ),
        'custom_fields' => array(
            'pregnancy_week' => $int( 'cf_pregnancy_week' ),
            'due_date'       => $int( 'cf_due_date' ),
            'notes'          => $int( 'cf_notes' ),
        ),
    );
}


/* =================================================================
   ENQUEUE ASSETS
   ================================================================= */

function echovisie_enqueue_assets() {
    global $post;

    $has_configurator = is_a( $post, 'WP_Post' ) && has_shortcode( $post->post_content, 'echovisie_booking' );

    if ( $has_configurator ) {
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

        wp_localize_script( 'echovisie-booking-js', 'echovisieBooking', array(
            'ajaxUrl' => admin_url( 'admin-ajax.php' ),
            'nonce'   => wp_create_nonce( 'echovisie_book' ),
        ) );
    }
}
add_action( 'wp_enqueue_scripts', 'echovisie_enqueue_assets' );


/* =================================================================
   AJAX HANDLER – Create Bookly appointments directly
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

    if ( ! class_exists( '\Bookly\Lib\Entities\Appointment' ) ) {
        wp_send_json_error( array( 'message' => 'Bookly is niet beschikbaar. Neem contact op met de beheerder.' ) );
    }

    // ── Customer details (required) ──
    $customer_name  = sanitize_text_field( $data['customerName'] ?? '' );
    $customer_email = sanitize_email( $data['customerEmail'] ?? '' );
    $customer_phone = sanitize_text_field( $data['customerPhone'] ?? '' );

    if ( ! $customer_name || ! $customer_email || ! $customer_phone ) {
        wp_send_json_error( array( 'message' => 'Vul je naam, e-mailadres en telefoonnummer in.' ) );
    }

    // ── Find or create Bookly Customer ──
    $customer = null;
    if ( class_exists( '\Bookly\Lib\Entities\Customer' ) ) {
        // Look up by email first
        $customer = \Bookly\Lib\Entities\Customer::query()
            ->where( 'email', $customer_email )
            ->findOne();

        if ( ! $customer ) {
            $customer = new \Bookly\Lib\Entities\Customer();
        }

        $name_parts = explode( ' ', $customer_name, 2 );
        $customer->setFirstName( $name_parts[0] );
        $customer->setLastName( isset( $name_parts[1] ) ? $name_parts[1] : '' );
        $customer->setFullName( $customer_name );
        $customer->setPhone( $customer_phone );
        $customer->setEmail( $customer_email );
        $customer->save();
    }

    $package_qty = absint( $data['packageQty'] ?? 1 );
    if ( $package_qty < 1 || $package_qty > 3 ) {
        $package_qty = 1;
    }

    // Pregnancy info for internal notes
    $preg_type = sanitize_text_field( $data['pregType'] ?? '' );
    $preg_date = sanitize_text_field( $data['pregDate'] ?? '' );

    $created_appointments = array();

    for ( $i = 0; $i < $package_qty; $i++ ) {
        $apt = $data['appointments'][ $i ] ?? array();

        $duration  = absint( $apt['duration'] ?? 10 );
        $slot_time = sanitize_text_field( $apt['slotTime'] ?? '' );
        $date      = sanitize_text_field( $apt['date'] ?? '' );
        $staff_id  = absint( $apt['staffId'] ?? 0 );

        if ( ! in_array( $duration, array( 10, 20, 30, 40, 50, 60 ), true ) ) {
            $duration = 10;
        }

        $service_id = $config['services'][ $duration ] ?? 0;

        if ( $service_id <= 0 ) {
            wp_send_json_error( array( 'message' => 'Service niet geconfigureerd voor ' . $duration . ' minuten.' ) );
        }

        if ( ! $date || ! $slot_time ) {
            wp_send_json_error( array( 'message' => 'Datum en tijdslot zijn verplicht voor afspraak ' . ( $i + 1 ) . '.' ) );
        }

        // Calculate start and end dates
        $start_date = $date . ' ' . $slot_time . ':00';
        $end_date   = gmdate( 'Y-m-d H:i:s', strtotime( $start_date ) + $duration * 60 );

        // Build internal note with booking details
        $note_parts = array( 'EchoVisie boeking — ' . $duration . ' min' );

        // Collect extras for Bookly format
        $extras_bookly = array();
        $raw_addons    = $apt['addons'] ?? array();
        $addon_names   = array();
        foreach ( $raw_addons as $addon_id => $addon_data ) {
            $addon_id = sanitize_key( $addon_id );
            $qty      = absint( $addon_data['qty'] ?? 0 );
            if ( $qty > 0 ) {
                $addon_names[] = $addon_id . ' x' . $qty;
                // Map to Bookly extra ID if configured
                $extra_id = $config['extras'][ $addon_id ] ?? 0;
                if ( $extra_id > 0 ) {
                    $extras_bookly[] = array( 'id' => $extra_id, 'quantity' => $qty );
                }
            }
        }
        if ( ! empty( $addon_names ) ) {
            $note_parts[] = "Extra's: " . implode( ', ', $addon_names );
        }

        if ( $preg_date ) {
            $preg_label = $preg_type === 'due' ? 'Uitgerekende datum' : 'Eerste dag LM';
            $note_parts[] = $preg_label . ': ' . $preg_date;
        }

        if ( $package_qty > 1 ) {
            $note_parts[] = 'Pakket: afspraak ' . ( $i + 1 ) . ' van ' . $package_qty;
        }

        // Create Bookly appointment
        try {
            $appointment = new \Bookly\Lib\Entities\Appointment();
            $appointment->setServiceId( $service_id );
            $appointment->setStaffId( $staff_id );
            $appointment->setStartDate( $start_date );
            $appointment->setEndDate( $end_date );
            $appointment->setInternalNote( implode( "\n", $note_parts ) );
            $appointment->save();

            // Link customer to appointment via CustomerAppointment
            if ( $customer && class_exists( '\Bookly\Lib\Entities\CustomerAppointment' ) ) {
                $ca = new \Bookly\Lib\Entities\CustomerAppointment();
                $ca->setCustomerId( $customer->getId() );
                $ca->setAppointmentId( $appointment->getId() );
                $ca->setNumberOfPersons( 1 );
                $ca->setStatus( 'approved' );

                if ( ! empty( $extras_bookly ) ) {
                    $ca->setExtras( json_encode( $extras_bookly ) );
                }

                // Attach custom fields (pregnancy info)
                $custom_fields_data = array();
                if ( $preg_date && $config['custom_fields']['due_date'] > 0 ) {
                    $custom_fields_data[] = array(
                        'id'    => $config['custom_fields']['due_date'],
                        'value' => $preg_date,
                    );
                }
                if ( ! empty( $custom_fields_data ) ) {
                    $ca->setCustomFields( json_encode( $custom_fields_data ) );
                }

                $ca->save();
            }

            // Resolve staff name for confirmation
            $staff_name = '';
            if ( $staff_id > 0 && class_exists( '\Bookly\Lib\Entities\Staff' ) ) {
                $staff = \Bookly\Lib\Entities\Staff::find( $staff_id );
                if ( $staff ) {
                    $staff_name = $staff->getFullName();
                }
            }

            $created_appointments[] = array(
                'id'         => $appointment->getId(),
                'date'       => $date,
                'date_label' => date_i18n( 'l j F Y', strtotime( $date ) ),
                'time'       => $slot_time,
                'duration'   => $duration,
                'staff_name' => $staff_name,
            );
        } catch ( \Exception $e ) {
            wp_send_json_error( array( 'message' => 'Fout bij het aanmaken van afspraak ' . ( $i + 1 ) . ': ' . $e->getMessage() ) );
        }
    }

    wp_send_json_success( array(
        'message'      => 'Je afspraak is bevestigd!',
        'appointments' => $created_appointments,
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

        $alternatives = array();

        if ( $service_id > 0 && $date && class_exists( '\Bookly\Lib\Entities\Staff' ) ) {
            // Query Bookly for available slots on the given date
            $slots_for_apt = echovisie_query_bookly_slots( $service_id, $date, $duration );

            // If no slots found, search nearby dates for alternatives
            if ( empty( $slots_for_apt ) ) {
                $alternatives = echovisie_find_nearby_dates( $service_id, $date, $duration, 2 );
            }
        }

        $all_slots[ $i ] = array(
            'slots'        => $slots_for_apt,
            'alternatives' => $alternatives,
        );
    }

    wp_send_json_success( array( 'slots' => $all_slots ) );
}

/**
 * Query Bookly's availability for a specific service on a specific date.
 *
 * Checks each staff member's schedule (StaffScheduleItem), holidays,
 * and existing appointments to determine truly available time slots.
 * Returns slots at 10-minute intervals within each staff member's working hours.
 *
 * Returns array of [ { time, staff_id, staff_name } ].
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

        // ── Check staff working hours from Bookly schedule ──
        $schedule_map = array(); // staff_id => { start, end } (timestamps)

        if ( class_exists( '\Bookly\Lib\Entities\StaffScheduleItem' ) ) {
            $day_index = (int) date( 'N', strtotime( $date ) ); // 1=Mon, 7=Sun

            $schedules = \Bookly\Lib\Entities\StaffScheduleItem::query()
                ->whereIn( 'staff_id', $staff_ids )
                ->where( 'day_index', $day_index )
                ->find();

            foreach ( $schedules as $sched ) {
                $start_time = $sched->getStartTime();
                $end_time   = $sched->getEndTime();
                // start_time is NULL when the staff doesn't work that day
                if ( $start_time && $end_time ) {
                    $schedule_map[ $sched->getStaffId() ] = array(
                        'start' => strtotime( $date . ' ' . $start_time ),
                        'end'   => strtotime( $date . ' ' . $end_time ),
                    );
                }
            }
        } else {
            // Fallback if schedule entity is unavailable: assume 09:00-20:00
            foreach ( $staff_ids as $sid ) {
                $schedule_map[ $sid ] = array(
                    'start' => strtotime( $date . ' 09:00:00' ),
                    'end'   => strtotime( $date . ' 20:00:00' ),
                );
            }
        }

        // ── Check holidays (per-staff and global) ──
        $holiday_staff = array();

        if ( class_exists( '\Bookly\Lib\Entities\Holiday' ) ) {
            $check_ids = array_merge( array( 0 ), $staff_ids );
            $holidays  = \Bookly\Lib\Entities\Holiday::query()
                ->whereIn( 'staff_id', $check_ids )
                ->where( 'date', $date )
                ->find();

            foreach ( $holidays as $h ) {
                $hid = $h->getStaffId();
                if ( (int) $hid === 0 ) {
                    // Global holiday — nobody works
                    return array();
                }
                $holiday_staff[] = $hid;
            }
        }

        // ── Query existing appointments on this date ──
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

        // ── Generate time slots (every 10 min within working hours) ──
        $slot_interval = 10 * 60; // 10 minutes
        $duration_sec  = $duration_min * 60;

        foreach ( $staff_ids as $sid ) {
            // Skip staff on holiday
            if ( in_array( $sid, $holiday_staff, true ) ) {
                continue;
            }

            // Skip staff with no schedule for this day
            if ( ! isset( $schedule_map[ $sid ] ) ) {
                continue;
            }

            $work_start = $schedule_map[ $sid ]['start'];
            $work_end   = $schedule_map[ $sid ]['end'];

            for ( $time = $work_start; $time + $duration_sec <= $work_end; $time += $slot_interval ) {
                $slot_end = $time + $duration_sec;
                $is_free  = true;

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

/**
 * Find the nearest dates with available slots, starting from $date.
 *
 * Searches up to 14 days forward from $date to find $count dates
 * that have at least one available slot. Returns an array of
 * [ { date: 'YYYY-MM-DD', date_label: '15 maart 2026', slot_count: 12 }, ... ]
 */
function echovisie_find_nearby_dates( $service_id, $date, $duration_min, $count = 2 ) {
    $results   = array();
    $max_days  = 14;
    $base_time = strtotime( $date );

    if ( ! $base_time ) {
        return $results;
    }

    for ( $offset = 0; $offset <= $max_days && count( $results ) < $count; $offset++ ) {
        // Skip the original date itself (offset 0) — we already know it's empty
        if ( $offset === 0 ) {
            continue;
        }

        $check_date = date( 'Y-m-d', $base_time + $offset * 86400 );
        $slots      = echovisie_query_bookly_slots( $service_id, $check_date, $duration_min );

        if ( ! empty( $slots ) ) {
            $results[] = array(
                'date'       => $check_date,
                'date_label' => date_i18n( 'l j F', strtotime( $check_date ) ),
                'slot_count' => count( $slots ),
            );
        }
    }

    return $results;
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

                <!-- Daytime discount info -->
                <div class="ev-section ev-time-section">
                    <div class="ev-daytime-info">
                        <span class="ev-daytime-info-icon">&#9728;&#65039;</span>
                        <div class="ev-daytime-info-text">
                            <strong>&euro;10 korting overdag</strong>
                            <span>Kies je een tijdslot v&oacute;&oacute;r 17:00? Dan krijg je automatisch &euro;10 korting op de sessieprijs!</span>
                        </div>
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

                <!-- Customer details -->
                <div class="ev-section ev-customer-section">
                    <h3 class="ev-section-title">Jouw gegevens</h3>
                    <p class="ev-package-hint">Vul je contactgegevens in zodat we je een bevestiging kunnen sturen</p>
                    <div class="ev-customer-fields">
                        <div class="ev-customer-field">
                            <label class="ev-label" for="ev-customer-name">Naam</label>
                            <input type="text" id="ev-customer-name" class="ev-customer-input" placeholder="Je volledige naam" autocomplete="name">
                        </div>
                        <div class="ev-customer-field">
                            <label class="ev-label" for="ev-customer-email">E-mailadres</label>
                            <input type="email" id="ev-customer-email" class="ev-customer-input" placeholder="naam@voorbeeld.nl" autocomplete="email">
                        </div>
                        <div class="ev-customer-field">
                            <label class="ev-label" for="ev-customer-phone">Telefoonnummer</label>
                            <input type="tel" id="ev-customer-phone" class="ev-customer-input" placeholder="06-12345678" autocomplete="tel">
                        </div>
                    </div>
                    <div id="ev-customer-error" class="ev-preg-error" style="display:none;"></div>
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
