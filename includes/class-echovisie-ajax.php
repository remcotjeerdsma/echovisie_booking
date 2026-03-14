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
        add_action( 'wp_ajax_echovisie_validate_voucher', array( $this, 'handle_validate_voucher' ) );
        add_action( 'wp_ajax_nopriv_echovisie_validate_voucher', array( $this, 'handle_validate_voucher' ) );
        add_action( 'wp_ajax_nopriv_echovisie_mollie_webhook', array( $this, 'handle_mollie_webhook' ) );
        add_action( 'wp_ajax_echovisie_mollie_webhook', array( $this, 'handle_mollie_webhook' ) );
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
     *
     * Uses Bookly's own Finder which correctly accounts for Google Calendar
     * events, schedule breaks, special days, holidays and existing bookings.
     */
    private function query_bookly_slots( $service_id, $date, $duration, $staff_ids, $s ) {
        // Require Bookly's Finder stack.
        if ( ! class_exists( '\Bookly\Lib\UserBookingData' )
            || ! class_exists( '\Bookly\Lib\ChainItem' )
            || ! class_exists( '\Bookly\Lib\Slots\Finder' ) ) {
            return array();
        }

        $tz  = wp_timezone();
        $dt  = new DateTime( $date, $tz );
        $dow = intval( $dt->format( 'N' ) ); // 1=Mon … 7=Sun

        $daytime_end = intval( $s['daytime_end_hour'] ?? 17 );
        $weekend_on  = intval( $s['weekend_surcharge'] ?? 1 );

        // Build staff name map.
        $staff_names = array();
        for ( $i = 1; $i <= 3; $i++ ) {
            $sid = intval( $s[ "staff_{$i}_id" ] ?? 0 );
            if ( $sid > 0 ) {
                $staff_names[ $sid ] = $s[ "staff_{$i}_name" ] ?? "Medewerker {$i}";
            }
        }

        // Build UserBookingData with the correct service + staff set.
        $userData = new \Bookly\Lib\UserBookingData( 'echovisie_slots_' . uniqid() );

        $chain_item = new \Bookly\Lib\ChainItem();
        $chain_item
            ->setServiceId( $service_id )
            ->setStaffIds( $staff_ids )
            ->setNumberOfPersons( 1 )
            ->setQuantity( 1 )
            ->setUnits( 1 );

        $userData->chain->clear();
        $userData->chain->add( $chain_item );

        $userData
            ->setDateFrom( $date )
            ->setDays( array( 1, 2, 3, 4, 5, 6, 7 ) )
            ->setTimeFrom( null )
            ->setTimeTo( null )
            ->setSlots( array() )
            ->setEditCartKeys( array() );

        // Stop the Finder as soon as it steps past the target date so we do
        // not waste time iterating future days.
        $target_date  = $date;
        $callback_stop = function( $client_dp, $groups_count, $slots_count, $available_slots_count ) use ( $target_date ) {
            return $client_dp->format( 'Y-m-d' ) > $target_date ? 1 : 0;
        };

        // Finder correctly handles: Google Calendar events (via Bookly Pro),
        // Outlook Calendar, schedule breaks, special days, holidays and all
        // existing Bookly appointments.
        $finder = new \Bookly\Lib\Slots\Finder( $userData, null, $callback_stop );
        $finder->setSelectedDate( $date );
        $finder->prepare()->load();

        $result     = array();
        $all_slots  = $finder->getSlots();

        if ( isset( $all_slots[ $date ] ) ) {
            /** @var \Bookly\Lib\Slots\Range[] $day_slots */
            foreach ( $all_slots[ $date ] as $slot ) {
                if ( ! $slot->notFullyBooked() ) {
                    continue;
                }

                $staff_id = $slot->staffId();
                $time_str = $slot->start()->toClientTz()->format( 'H:i' );
                $hour     = (int) substr( $time_str, 0, 2 );
                $is_peak  = ( $hour >= $daytime_end ) || ( $weekend_on && ( $dow === 6 || $dow === 7 ) );

                $result[] = array(
                    'time'        => $time_str,
                    'staff_id'    => $staff_id,
                    'staff_name'  => $staff_names[ $staff_id ] ?? 'Medewerker',
                    'is_peak'     => $is_peak,
                    'is_adjacent' => false,
                );
            }
        }

        usort( $result, function ( $a, $b ) {
            return strcmp( $a['time'], $b['time'] );
        } );

        // Detect slots immediately adjacent to existing appointments (same staff).
        // A 5% discount applies to these slots to encourage filling gaps.
        if ( ! empty( $result ) ) {
            $existing = \Bookly\Lib\Entities\Appointment::query()
                ->whereGte( 'start_date', $date . ' 00:00:00' )
                ->whereLte( 'start_date', $date . ' 23:59:59' )
                ->whereIn( 'staff_id', $staff_ids )
                ->fetchArray();

            if ( ! empty( $existing ) ) {
                foreach ( $result as &$slot_data ) {
                    $slot_start = $date . ' ' . $slot_data['time'] . ':00';
                    $slot_end_dt = new DateTime( $slot_start, $tz );
                    $slot_end_dt->modify( "+{$duration} minutes" );
                    $slot_end = $slot_end_dt->format( 'Y-m-d H:i:s' );

                    foreach ( $existing as $appt ) {
                        if ( (int) $appt['staff_id'] !== (int) $slot_data['staff_id'] ) {
                            continue;
                        }
                        // Adjacent if slot ends exactly when appt starts, or slot starts exactly when appt ends
                        if ( $appt['start_date'] === $slot_end || $appt['end_date'] === $slot_start ) {
                            $slot_data['is_adjacent'] = true;
                            break;
                        }
                    }
                }
                unset( $slot_data );
            }
        }

        return $result;
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

        // Check Bookly classes required for the proper booking flow.
        if ( ! class_exists( '\Bookly\Lib\UserBookingData' )
            || ! class_exists( '\Bookly\Lib\CartItem' )
            || ! class_exists( '\Bookly\Lib\Entities\Appointment' ) ) {
            wp_send_json_error( array( 'message' => 'Bookly plugin is niet actief.' ) );
        }

        $s = get_option( 'echovisie_settings', echovisie_default_settings() );

        // Customer data.
        $first_name   = sanitize_text_field( $data['customer']['first_name'] ?? '' );
        $last_name    = sanitize_text_field( $data['customer']['last_name'] ?? '' );
        $email        = sanitize_email( $data['customer']['email'] ?? '' );
        $phone        = sanitize_text_field( $data['customer']['phone'] ?? '' );
        $notes        = sanitize_textarea_field( $data['customer']['notes'] ?? '' );
        $voucher_code = sanitize_text_field( $data['voucher_code'] ?? '' );

        if ( ! $first_name || ! $email || ! $phone ) {
            wp_send_json_error( array( 'message' => 'Vul alle verplichte velden in.' ) );
        }

        // Pregnancy data.
        $preg_type = sanitize_text_field( $data['pregnancy']['type'] ?? '' );
        $preg_date = sanitize_text_field( $data['pregnancy']['date'] ?? '' );
        $preg_week = intval( $data['pregnancy']['week'] ?? 0 );

        // Verify pricing server-side.
        $price_check = EchoVisie_Pricing::calculate_total( $data['appointments'] );

        $tz  = wp_timezone();
        $qty = count( $data['appointments'] );

        // ── 1. Validate all slots are still available before saving ──────────
        $appt_data = array(); // pre-processed appointment rows
        foreach ( $data['appointments'] as $index => $appt ) {
            $duration   = intval( $appt['duration'] ?? 10 );
            $date       = sanitize_text_field( $appt['date'] ?? '' );
            $time       = sanitize_text_field( $appt['time'] ?? '' );
            $staff_id   = intval( $appt['staff_id'] ?? 0 );
            $service_id = intval( $appt['service_id'] ?? 0 );

            if ( ! $date || ! $time || ! $staff_id || ! $service_id ) {
                wp_send_json_error( array( 'message' => 'Ontbrekende afspraakgegevens voor afspraak ' . ( $index + 1 ) . '.' ) );
            }

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

            $appt_data[ $index ] = compact( 'duration', 'date', 'time', 'staff_id', 'service_id', 'start_dt', 'end_dt', 'appt' );
        }

        // ── 2. Build Bookly UserBookingData ──────────────────────────────────
        //
        // Using Bookly's own save() flow ensures the customer record is
        // properly created/found, all Bookly hooks fire (including calendar
        // sync), and email notifications are sent via Cart\Sender::send().
        //
        $userData = new \Bookly\Lib\UserBookingData( 'echovisie_book_' . uniqid() );

        $userData
            ->setFirstName( $first_name )
            ->setLastName( $last_name )
            ->setEmail( $email )
            ->setPhone( $phone )
            ->setNotes( $notes );

        // ── 3. Add one CartItem per appointment ──────────────────────────────
        $cf_preg_week = $s['cf_pregnancy_week'] ?? '';
        $cf_due_date  = $s['cf_due_date'] ?? '';
        $cf_notes_id  = $s['cf_notes'] ?? '';

        // Build the note parts that are shared across appointments.
        $base_note_parts = array();
        if ( $preg_week ) {
            $base_note_parts[] = "Zwangerschapsweek: {$preg_week}";
        }
        if ( $preg_date ) {
            $base_note_parts[] = ( $preg_type === 'due' ? 'Uitgerekende datum' : 'Laatste menstruatie' ) . ": {$preg_date}";
        }

        foreach ( $appt_data as $index => $row ) {
            $custom_fields = array();
            if ( $cf_preg_week && $preg_week ) {
                $custom_fields[] = array( 'id' => intval( $cf_preg_week ), 'value' => strval( $preg_week ) );
            }
            if ( $cf_due_date && $preg_date ) {
                $custom_fields[] = array( 'id' => intval( $cf_due_date ), 'value' => $preg_date );
            }
            if ( $cf_notes_id && $notes && $index === 0 ) {
                $custom_fields[] = array( 'id' => intval( $cf_notes_id ), 'value' => $notes );
            }

            // Slot format expected by Cart::save(): [service_id, staff_id, 'Y-m-d H:i:s']
            $cart_item = new \Bookly\Lib\CartItem();
            $cart_item
                ->setServiceId( $row['service_id'] )
                ->setStaffIds( array( $row['staff_id'] ) )
                ->setNumberOfPersons( 1 )
                ->setUnits( 1 )
                ->setSlots( array( array( $row['service_id'], $row['staff_id'], $row['start_dt']->format( 'Y-m-d H:i:s' ) ) ) )
                ->setCustomFields( $custom_fields );

            $userData->cart->add( $cart_item );
        }

        // ── 4. Apply coupon/voucher ───────────────────────────────────────────
        // User-entered voucher takes priority; fall back to automatic package coupon.
        if ( $voucher_code ) {
            $userData->setCouponCode( $voucher_code );
        } elseif ( $qty >= 3 && ! empty( $s['coupon_3pack'] ) ) {
            $userData->setCouponCode( $s['coupon_3pack'] );
        } elseif ( $qty >= 2 && ! empty( $s['coupon_2pack'] ) ) {
            $userData->setCouponCode( $s['coupon_2pack'] );
        }

        // ── 5. Save via Bookly – creates customer, appointments, CustomerAppointment records ──
        $order = $userData->save( null );

        // ── 6. Set internal note on each appointment after save ──────────────
        foreach ( $order->getItems() as $item_key => $item ) {
            if ( ! isset( $appt_data[ $item_key ] ) ) {
                continue;
            }
            $row   = $appt_data[ $item_key ];
            $appt  = $row['appt'];

            $note_parts = $base_note_parts;

            $addons_desc = $this->describe_addons( $row['duration'], $appt['addons'] ?? array(), $s );
            if ( $addons_desc ) {
                $note_parts[] = "Extra: {$addons_desc}";
            }
            if ( ! empty( $appt['gender_opt_out'] ) ) {
                $note_parts[] = "Geen geslachtsbepaling gewenst";
            }
            if ( $notes && $item_key === 0 ) {
                $note_parts[] = "Opmerking klant: {$notes}";
            }
            if ( $qty > 1 ) {
                $note_parts[] = "Pakket: afspraak " . ( $item_key + 1 ) . " van {$qty}";
            }

            if ( ! empty( $note_parts ) && method_exists( $item, 'getAppointment' ) ) {
                $appointment = $item->getAppointment();
                if ( $appointment ) {
                    $appointment->setInternalNote( implode( "\n", $note_parts ) )->save();
                }
            }
        }

        // ── 7. Send Bookly notifications (email, SMS, etc.) ──────────────────
        if ( class_exists( '\Bookly\Lib\Notifications\Cart\Sender' ) ) {
            \Bookly\Lib\Notifications\Cart\Sender::send( $order );
        }

        // ── 8. Build appointments summary ────────────────────────────────────
        $created = array();
        foreach ( $appt_data as $index => $row ) {
            $created[] = array(
                'id'    => null,
                'date'  => $row['start_dt']->format( 'd-m-Y' ),
                'time'  => $row['start_dt']->format( 'H:i' ),
                'staff' => $this->get_staff_name( $row['staff_id'], $s ),
            );
        }

        // ── 9. Mollie payment (if enabled) ───────────────────────────────────
        if ( intval( $s['mollie_enabled'] ?? 0 ) && ! empty( $s['mollie_api_key'] ) ) {
            $page_url = sanitize_text_field( $data['page_url'] ?? '' );
            if ( ! $page_url ) {
                $page_url = home_url( '/' );
            }

            $token        = bin2hex( random_bytes( 16 ) );
            $currency     = sanitize_text_field( $s['mollie_currency'] ?? 'EUR' );
            $description  = 'EchoVisie – ' . $first_name . ' ' . $last_name;
            $redirect_url = add_query_arg( array(
                'ev_token'  => $token,
                'ev_status' => 'return',
            ), $page_url );
            $webhook_url  = admin_url( 'admin-ajax.php?action=echovisie_mollie_webhook' );

            try {
                $mollie  = new EchoVisie_Mollie( $s['mollie_api_key'] );
                $payment = $mollie->create_payment(
                    (float) $price_check['total'],
                    $currency,
                    $description,
                    $redirect_url,
                    $webhook_url,
                    array( 'ev_token' => $token )
                );

                set_transient( 'echovisie_pay_' . $token, array(
                    'mollie_payment_id' => $payment->id,
                    'appointments'      => $created,
                    'total'             => $price_check['total'],
                    'customer'          => array(
                        'first_name' => $first_name,
                        'last_name'  => $last_name,
                        'email'      => $email,
                    ),
                    'status' => 'pending',
                ), DAY_IN_SECONDS );

                wp_send_json_success( array(
                    'requires_payment' => true,
                    'checkout_url'     => EchoVisie_Mollie::checkout_url( $payment ),
                ) );
            } catch ( \Exception $e ) {
                error_log( 'EchoVisie Mollie: ' . $e->getMessage() );
                // Fall through to normal success response on Mollie error
            }
        }

        // ── 10. Normal (non-payment) success response ────────────────────────
        wp_send_json_success( array(
            'message'      => 'Je afspraak is bevestigd!',
            'appointments' => $created,
            'total'        => $price_check['total'],
        ) );
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

    /* ──────────────────────────────────────────────────────
     * VALIDATE VOUCHER CODE
     * ────────────────────────────────────────────────────── */
    public function handle_validate_voucher() {
        check_ajax_referer( 'echovisie_nonce', 'nonce' );

        $code = sanitize_text_field( $_POST['code'] ?? '' );

        if ( ! $code ) {
            wp_send_json_error( array( 'message' => 'Geen code opgegeven.' ) );
        }

        // Require Bookly Coupons add-on.
        if ( ! class_exists( '\BooklyCoupons\Lib\Entities\Coupon' ) ) {
            wp_send_json_error( array( 'message' => 'Kortingscodes zijn niet beschikbaar.' ) );
        }

        /** @var \BooklyCoupons\Lib\Entities\Coupon|false $coupon */
        $coupon = \Bookly\Frontend\Modules\Booking\Proxy\Coupons::findOneByCode( $code );

        if ( ! $coupon ) {
            wp_send_json_error( array( 'message' => 'Deze kortingscode bestaat niet.' ) );
        }

        if ( $coupon->fullyUsed() ) {
            wp_send_json_error( array( 'message' => 'Deze kortingscode is al volledig gebruikt.' ) );
        }

        if ( ! $coupon->started() ) {
            wp_send_json_error( array( 'message' => 'Deze kortingscode is nog niet geldig.' ) );
        }

        if ( $coupon->expired() ) {
            wp_send_json_error( array( 'message' => 'Deze kortingscode is verlopen.' ) );
        }

        $discount_pct = (float) $coupon->getDiscount();   // e.g. 10 for 10 %
        $deduction    = (float) $coupon->getDeduction();  // flat amount

        // Build a human-readable label.
        $parts = array();
        if ( $discount_pct > 0 ) {
            $parts[] = number_format( $discount_pct, 0, ',', '' ) . '% korting';
        }
        if ( $deduction > 0 ) {
            $parts[] = '€\u00a0' . number_format( $deduction, 2, ',', '' ) . ' korting';
        }
        $label = ! empty( $parts ) ? implode( ' + ', $parts ) : 'Korting';

        wp_send_json_success( array(
            'valid'        => true,
            'discount_pct' => $discount_pct,
            'deduction'    => $deduction,
            'label'        => $label,
        ) );
    }

    /* ──────────────────────────────────────────────────────
     * MOLLIE WEBHOOK
     * ────────────────────────────────────────────────────── */
    public function handle_mollie_webhook() {
        $payment_id = sanitize_text_field( $_POST['id'] ?? '' );
        if ( ! $payment_id ) {
            status_header( 200 );
            exit;
        }

        $s = get_option( 'echovisie_settings', echovisie_default_settings() );
        if ( empty( $s['mollie_api_key'] ) ) {
            status_header( 200 );
            exit;
        }

        try {
            $mollie  = new EchoVisie_Mollie( $s['mollie_api_key'] );
            $payment = $mollie->get_payment( $payment_id );
            $token   = $payment->metadata->ev_token ?? '';

            if ( $token ) {
                $booking = get_transient( 'echovisie_pay_' . $token );
                if ( $booking ) {
                    $booking['status'] = EchoVisie_Mollie::is_paid( $payment )
                        ? 'paid'
                        : ( EchoVisie_Mollie::is_pending( $payment ) ? 'pending' : 'failed' );
                    set_transient( 'echovisie_pay_' . $token, $booking, DAY_IN_SECONDS );
                }
            }
        } catch ( \Exception $e ) {
            error_log( 'EchoVisie Mollie webhook: ' . $e->getMessage() );
        }

        status_header( 200 );
        exit;
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
