<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class EchoVisie_Ajax {

    private static $instance = null;

    public static function init() {
        if ( self::$instance === null ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        // Public AJAX (logged-in + logged-out)
        add_action( 'wp_ajax_echovisie_get_slots', array( $this, 'handle_get_slots' ) );
        add_action( 'wp_ajax_nopriv_echovisie_get_slots', array( $this, 'handle_get_slots' ) );
        add_action( 'wp_ajax_echovisie_book', array( $this, 'handle_book' ) );
        add_action( 'wp_ajax_nopriv_echovisie_book', array( $this, 'handle_book' ) );
    }

    /* ──────────────────────────────────────────────────────
     * GET AVAILABLE SLOTS
     * ────────────────────────────────────────────────────── */
    public function handle_get_slots() {
        check_ajax_referer( 'echovisie_nonce', 'nonce' );

        $service_id = intval( $_POST['service_id'] ?? 0 );
        $date       = sanitize_text_field( $_POST['date'] ?? '' );
        $duration   = intval( $_POST['duration'] ?? 10 );

        if ( ! $service_id || ! $date ) {
            wp_send_json_error( array( 'message' => 'Ontbrekende gegevens.' ) );
        }

        // Validate date format
        if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date ) ) {
            wp_send_json_error( array( 'message' => 'Ongeldig datumformaat.' ) );
        }

        $s = get_option( 'echovisie_settings', echovisie_default_settings() );

        // Collect staff IDs
        $staff_ids = array();
        for ( $i = 1; $i <= 3; $i++ ) {
            $sid = intval( $s[ "staff_{$i}_id" ] ?? 0 );
            if ( $sid > 0 ) {
                $staff_ids[] = $sid;
            }
        }

        if ( empty( $staff_ids ) ) {
            wp_send_json_error( array( 'message' => 'Geen medewerkers geconfigureerd.' ) );
        }

        // Check Bookly is available
        if ( ! class_exists( '\Bookly\Lib\Entities\Appointment' ) ) {
            wp_send_json_error( array( 'message' => 'Bookly plugin is niet actief.' ) );
        }

        $slots = $this->query_bookly_slots( $service_id, $date, $duration, $staff_ids, $s );

        // If no slots, find nearby dates
        $nearby = array();
        if ( empty( $slots ) ) {
            $nearby = $this->find_nearby_dates( $service_id, $date, $duration, $staff_ids, $s );
        }

        wp_send_json_success( array(
            'slots'   => $slots,
            'nearby'  => $nearby,
        ) );
    }

    /**
     * Query Bookly for available timeslots on a specific date.
     */
    private function query_bookly_slots( $service_id, $date, $duration, $staff_ids, $s ) {
        $tz = wp_timezone();
        $slots = array();

        $daytime_end = intval( $s['daytime_end_hour'] ?? 17 );
        $weekend_on  = intval( $s['weekend_surcharge'] ?? 1 );

        // Date info
        $dt  = new DateTime( $date, $tz );
        $dow = intval( $dt->format( 'N' ) ); // 1=Mon, 7=Sun

        // Check which staff offer this service
        $staff_services = \Bookly\Lib\Entities\StaffService::query()
            ->where( 'service_id', $service_id )
            ->whereIn( 'staff_id', $staff_ids )
            ->find();

        if ( empty( $staff_services ) ) {
            return $slots;
        }

        $available_staff = array();
        foreach ( $staff_services as $ss ) {
            $available_staff[] = intval( $ss->getStaffId() );
        }

        // Get existing appointments for this date
        $date_start = $date . ' 00:00:00';
        $date_end   = $date . ' 23:59:59';

        $existing = \Bookly\Lib\Entities\Appointment::query()
            ->whereIn( 'staff_id', $available_staff )
            ->whereGte( 'start_date', $date_start )
            ->whereLte( 'start_date', $date_end )
            ->find();

        // Build busy map: staff_id => [ [ start_ts, end_ts ], ... ]
        $busy = array();
        foreach ( $existing as $appt ) {
            $sid = intval( $appt->getStaffId() );
            $start_ts = ( new DateTime( $appt->getStartDate(), $tz ) )->getTimestamp();
            $end_ts   = ( new DateTime( $appt->getEndDate(), $tz ) )->getTimestamp();
            $busy[ $sid ][] = array( $start_ts, $end_ts );
        }

        // Get staff schedule for the day of week
        $day_index = $dow; // Bookly uses 1-7

        // Try to use StaffScheduleItem if available
        $schedules = array();
        if ( class_exists( '\Bookly\Lib\Entities\StaffScheduleItem' ) ) {
            $schedule_items = \Bookly\Lib\Entities\StaffScheduleItem::query()
                ->whereIn( 'staff_id', $available_staff )
                ->where( 'day_index', $day_index )
                ->find();

            foreach ( $schedule_items as $item ) {
                $sid = intval( $item->getStaffId() );
                $start = $item->getStartTime();
                $end   = $item->getEndTime();
                if ( $start && $end ) {
                    $schedules[ $sid ] = array(
                        'start' => $start,
                        'end'   => $end,
                    );
                }
            }
        }

        // Check holidays
        $holidays = array();
        if ( class_exists( '\Bookly\Lib\Entities\Holiday' ) ) {
            $holiday_items = \Bookly\Lib\Entities\Holiday::query()
                ->where( 'date', $date )
                ->find();

            foreach ( $holiday_items as $h ) {
                $hStaff = $h->getStaffId();
                if ( $hStaff === null || $hStaff == 0 ) {
                    // Global holiday
                    return $slots; // No slots on global holidays
                }
                $holidays[] = intval( $hStaff );
            }
        }

        // Build staff name map
        $staff_names = array();
        for ( $i = 1; $i <= 3; $i++ ) {
            $sid = intval( $s[ "staff_{$i}_id" ] ?? 0 );
            if ( $sid > 0 ) {
                $staff_names[ $sid ] = $s[ "staff_{$i}_name" ] ?? "Medewerker {$i}";
            }
        }

        // Generate slots per staff
        $duration_sec = $duration * 60;
        $slot_interval = 600; // 10 minutes

        foreach ( $available_staff as $sid ) {
            if ( in_array( $sid, $holidays, true ) ) continue;

            // Get schedule or default 09:00-20:00
            $sched_start = '09:00:00';
            $sched_end   = '20:00:00';
            if ( isset( $schedules[ $sid ] ) ) {
                $sched_start = $schedules[ $sid ]['start'];
                $sched_end   = $schedules[ $sid ]['end'];
            }

            $work_start = ( new DateTime( $date . ' ' . $sched_start, $tz ) )->getTimestamp();
            $work_end   = ( new DateTime( $date . ' ' . $sched_end, $tz ) )->getTimestamp();

            for ( $t = $work_start; $t + $duration_sec <= $work_end; $t += $slot_interval ) {
                $slot_end = $t + $duration_sec;

                // Check overlap with existing appointments
                $is_busy = false;
                if ( isset( $busy[ $sid ] ) ) {
                    foreach ( $busy[ $sid ] as $b ) {
                        if ( $t < $b[1] && $slot_end > $b[0] ) {
                            $is_busy = true;
                            break;
                        }
                    }
                }
                if ( $is_busy ) continue;

                $slot_dt = ( new DateTime() )->setTimezone( $tz )->setTimestamp( $t );
                $hour    = intval( $slot_dt->format( 'G' ) );
                $is_peak = ( $hour >= $daytime_end ) || ( $weekend_on && ( $dow === 6 || $dow === 7 ) );

                $slots[] = array(
                    'time'       => $slot_dt->format( 'H:i' ),
                    'staff_id'   => $sid,
                    'staff_name' => $staff_names[ $sid ] ?? "Medewerker",
                    'is_peak'    => $is_peak,
                );
            }
        }

        // Sort by time
        usort( $slots, function ( $a, $b ) {
            return strcmp( $a['time'], $b['time'] );
        } );

        return $slots;
    }

    /**
     * Find nearest dates with availability (±14 days).
     */
    private function find_nearby_dates( $service_id, $date, $duration, $staff_ids, $s ) {
        $tz     = wp_timezone();
        $base   = new DateTime( $date, $tz );
        $prev   = null;
        $next   = null;

        for ( $offset = 1; $offset <= 14; $offset++ ) {
            // Check forward
            if ( $next === null ) {
                $fwd = clone $base;
                $fwd->modify( "+{$offset} days" );
                $fwd_str = $fwd->format( 'Y-m-d' );
                $fwd_slots = $this->query_bookly_slots( $service_id, $fwd_str, $duration, $staff_ids, $s );
                if ( ! empty( $fwd_slots ) ) {
                    $next = $fwd_str;
                }
            }

            // Check backward
            if ( $prev === null ) {
                $bwd = clone $base;
                $bwd->modify( "-{$offset} days" );
                $bwd_str = $bwd->format( 'Y-m-d' );
                // Only look back to today
                $today = new DateTime( 'now', $tz );
                if ( $bwd >= $today ) {
                    $bwd_slots = $this->query_bookly_slots( $service_id, $bwd_str, $duration, $staff_ids, $s );
                    if ( ! empty( $bwd_slots ) ) {
                        $prev = $bwd_str;
                    }
                }
            }

            if ( $prev !== null && $next !== null ) break;
        }

        return array(
            'prev' => $prev,
            'next' => $next,
        );
    }

    /* ──────────────────────────────────────────────────────
     * BOOK APPOINTMENT(S)
     * ────────────────────────────────────────────────────── */
    public function handle_book() {
        check_ajax_referer( 'echovisie_nonce', 'nonce' );

        $data = json_decode( stripslashes( $_POST['data'] ?? '{}' ), true );
        if ( empty( $data ) || empty( $data['appointments'] ) ) {
            wp_send_json_error( array( 'message' => 'Geen afspraakgegevens ontvangen.' ) );
        }

        // Check Bookly
        if ( ! class_exists( '\Bookly\Lib\Entities\Appointment' ) ) {
            wp_send_json_error( array( 'message' => 'Bookly plugin is niet actief.' ) );
        }

        $s = get_option( 'echovisie_settings', echovisie_default_settings() );

        // Customer data
        $first_name = sanitize_text_field( $data['customer']['first_name'] ?? '' );
        $last_name  = sanitize_text_field( $data['customer']['last_name'] ?? '' );
        $email      = sanitize_email( $data['customer']['email'] ?? '' );
        $phone      = sanitize_text_field( $data['customer']['phone'] ?? '' );
        $notes      = sanitize_textarea_field( $data['customer']['notes'] ?? '' );

        if ( ! $first_name || ! $email || ! $phone ) {
            wp_send_json_error( array( 'message' => 'Vul alle verplichte velden in.' ) );
        }

        // Pregnancy data
        $preg_type = sanitize_text_field( $data['pregnancy']['type'] ?? '' );
        $preg_date = sanitize_text_field( $data['pregnancy']['date'] ?? '' );
        $preg_week = intval( $data['pregnancy']['week'] ?? 0 );

        // Verify pricing server-side
        $price_check = EchoVisie_Pricing::calculate_total( $data['appointments'] );

        // Find or create customer
        $customer = $this->find_or_create_customer( $first_name, $last_name, $email, $phone );
        if ( ! $customer ) {
            wp_send_json_error( array( 'message' => 'Kon klant niet aanmaken.' ) );
        }

        $tz = wp_timezone();
        $created = array();

        foreach ( $data['appointments'] as $index => $appt ) {
            $duration   = intval( $appt['duration'] ?? 10 );
            $date       = sanitize_text_field( $appt['date'] ?? '' );
            $time       = sanitize_text_field( $appt['time'] ?? '' );
            $staff_id   = intval( $appt['staff_id'] ?? 0 );
            $service_id = intval( $appt['service_id'] ?? 0 );

            if ( ! $date || ! $time || ! $staff_id || ! $service_id ) {
                wp_send_json_error( array( 'message' => 'Ontbrekende afspraakgegevens voor afspraak ' . ( $index + 1 ) . '.' ) );
            }

            // Verify slot is still available
            $start_dt = new DateTime( $date . ' ' . $time . ':00', $tz );
            $end_dt   = clone $start_dt;
            $end_dt->modify( "+{$duration} minutes" );

            $overlap = \Bookly\Lib\Entities\Appointment::query()
                ->where( 'staff_id', $staff_id )
                ->whereLt( 'start_date', $end_dt->format( 'Y-m-d H:i:s' ) )
                ->whereGt( 'end_date', $start_dt->format( 'Y-m-d H:i:s' ) )
                ->count();

            if ( $overlap > 0 ) {
                wp_send_json_error( array(
                    'message' => 'Het gekozen tijdstip voor afspraak ' . ( $index + 1 ) . ' is helaas niet meer beschikbaar. Probeer een ander tijdstip.'
                ) );
            }

            // Build internal note
            $note_parts = array();
            if ( $preg_week ) {
                $note_parts[] = "Zwangerschapsweek: {$preg_week}";
            }
            if ( $preg_date ) {
                $note_parts[] = ( $preg_type === 'due' ? 'Uitgerekende datum' : 'Laatste menstruatie' ) . ": {$preg_date}";
            }
            $addons_desc = $this->describe_addons( $duration, $appt['addons'] ?? array(), $s );
            if ( $addons_desc ) {
                $note_parts[] = "Extra: {$addons_desc}";
            }
            if ( ! empty( $appt['gender_opt_out'] ) ) {
                $note_parts[] = "Geen geslachtsbepaling gewenst";
            }
            if ( $notes && $index === 0 ) {
                $note_parts[] = "Opmerking klant: {$notes}";
            }

            $qty = count( $data['appointments'] );
            if ( $qty > 1 ) {
                $note_parts[] = "Pakket: afspraak " . ( $index + 1 ) . " van {$qty}";
            }

            // Create appointment
            $appointment = new \Bookly\Lib\Entities\Appointment();
            $appointment->setServiceId( $service_id );
            $appointment->setStaffId( $staff_id );
            $appointment->setStartDate( $start_dt->format( 'Y-m-d H:i:s' ) );
            $appointment->setEndDate( $end_dt->format( 'Y-m-d H:i:s' ) );
            $appointment->setInternalNote( implode( "\n", $note_parts ) );
            $appointment->save();

            $appt_id = $appointment->getId();

            // Link customer
            if ( class_exists( '\Bookly\Lib\Entities\CustomerAppointment' ) ) {
                $ca = new \Bookly\Lib\Entities\CustomerAppointment();
                $ca->setCustomerId( $customer->getId() );
                $ca->setAppointmentId( $appt_id );
                $ca->setStatus( 'approved' );

                // Custom fields
                $custom_fields = array();
                $cf_preg_week = $s['cf_pregnancy_week'] ?? '';
                $cf_due_date  = $s['cf_due_date'] ?? '';
                $cf_notes_id  = $s['cf_notes'] ?? '';

                if ( $cf_preg_week && $preg_week ) {
                    $custom_fields[] = array( 'id' => intval( $cf_preg_week ), 'value' => strval( $preg_week ) );
                }
                if ( $cf_due_date && $preg_date ) {
                    $custom_fields[] = array( 'id' => intval( $cf_due_date ), 'value' => $preg_date );
                }
                if ( $cf_notes_id && $notes && $index === 0 ) {
                    $custom_fields[] = array( 'id' => intval( $cf_notes_id ), 'value' => $notes );
                }

                if ( ! empty( $custom_fields ) ) {
                    $ca->setCustomFields( wp_json_encode( $custom_fields ) );
                }

                $ca->save();
            }

            $created[] = array(
                'id'    => $appt_id,
                'date'  => $start_dt->format( 'd-m-Y' ),
                'time'  => $start_dt->format( 'H:i' ),
                'staff' => $this->get_staff_name( $staff_id, $s ),
            );
        }

        wp_send_json_success( array(
            'message'      => 'Je afspraak is bevestigd!',
            'appointments' => $created,
            'total'        => $price_check['total'],
        ) );
    }

    /**
     * Find or create a Bookly customer.
     */
    private function find_or_create_customer( $first_name, $last_name, $email, $phone ) {
        if ( ! class_exists( '\Bookly\Lib\Entities\Customer' ) ) {
            return null;
        }

        // Try to find by email
        $existing = \Bookly\Lib\Entities\Customer::query()
            ->where( 'email', $email )
            ->findOne();

        if ( $existing ) {
            return $existing;
        }

        $customer = new \Bookly\Lib\Entities\Customer();
        $customer->setFirstName( $first_name );
        $customer->setLastName( $last_name );
        $customer->setEmail( $email );
        $customer->setPhone( $phone );
        $customer->save();

        return $customer;
    }

    /**
     * Get staff name from settings.
     */
    private function get_staff_name( $staff_id, $s ) {
        for ( $i = 1; $i <= 3; $i++ ) {
            if ( intval( $s[ "staff_{$i}_id" ] ?? 0 ) === $staff_id ) {
                return $s[ "staff_{$i}_name" ] ?? "Medewerker {$i}";
            }
        }
        return 'Medewerker';
    }

    /**
     * Build a human-readable description of addons for internal note.
     */
    private function describe_addons( $duration, $addons, $s ) {
        $parts = array();

        if ( ! empty( $addons['add_3d'] ) ) {
            $parts[] = '3D beelden';
        }
        if ( ! empty( $addons['add_usb'] ) ) {
            $parts[] = 'USB-stick';
        }
        if ( ! empty( $addons['add_recording'] ) ) {
            $parts[] = 'Volledige opname';
        }
        $ea4 = intval( $addons['extra_a4'] ?? 0 );
        if ( $ea4 > 0 ) {
            $parts[] = "{$ea4}x extra A4 afdruk";
        }
        $e10 = intval( $addons['extra_10x15'] ?? 0 );
        if ( $e10 > 0 ) {
            $parts[] = "{$e10}x extra 10x15 afdruk";
        }

        return implode( ', ', $parts );
    }
}

EchoVisie_Ajax::init();
