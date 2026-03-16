<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class EchoVisie_Pricing {

    /**
     * Get all settings with defaults.
     */
    public static function settings() {
        return get_option( 'echovisie_settings', echovisie_default_settings() );
    }

    /**
     * Base price for a given duration.
     */
    public static function base_price( $duration ) {
        $s = self::settings();
        $base_price = floatval( $s['base_price'] ?? 9 );
        $per_block  = floatval( $s['price_per_block'] ?? 15 );
        return $base_price + $per_block * ( $duration / 10 );
    }

    /**
     * Surcharge for peak (evening/weekend/special-day) slots.
     *
     * Peak is determined by Bookly's staff schedule:
     *   - Special day entry for that date → peak
     *   - Time outside the regular weekly schedule hours → peak
     *   - No schedule data available → no surcharge (daytime assumed)
     *
     * @param string $time_str  'H:i'
     * @param string $date_str  'Y-m-d'
     * @param int    $staff_id  Bookly staff ID (0 = unknown → no surcharge)
     */
    public static function surcharge( $time_str, $date_str, $staff_id = 0 ) {
        if ( ! $staff_id ) {
            return 0;
        }

        $s      = self::settings();
        $amount = floatval( $s['surcharge_amount'] ?? 10 );

        if ( self::is_peak( $time_str, $date_str, $staff_id ) ) {
            return $amount;
        }

        return 0;
    }

    /**
     * Returns true when the slot time falls within a configured special-hours
     * window in bookly_staff_special_hours for that staff member on that weekday.
     *
     * Bookly day_index: 1=Sun … 7=Sat (PHP N: 1=Mon … 7=Sun).
     * The Special Hours addon table may not exist; suppress_errors handles that.
     */
    public static function is_peak( $time_str, $date_str, $staff_id ) {
        global $wpdb;

        $tz         = wp_timezone();
        $dt         = new DateTime( $date_str, $tz );
        $bookly_day = intval( $dt->format( 'N' ) ) % 7 + 1;
        $t          = substr( $time_str, 0, 5 );

        $wpdb->suppress_errors( true );
        $rows = $wpdb->get_results( $wpdb->prepare(
            "SELECT start_time, end_time
               FROM {$wpdb->prefix}bookly_staff_special_hours
              WHERE staff_id = %d
                AND FIND_IN_SET(%d, days) > 0",
            $staff_id, $bookly_day
        ) );
        $wpdb->suppress_errors( false );

        foreach ( (array) $rows as $row ) {
            $s = substr( $row->start_time, 0, 5 );
            $e = substr( $row->end_time,   0, 5 );
            if ( $t >= $s && $t < $e ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Content rules for a given duration.
     */
    public static function content_rules( $duration ) {
        $s = self::settings();
        return array(
            'photos_2d'      => intval( $s[ "content_{$duration}_2d" ] ?? 0 ),
            'photos_3d'      => intval( $s[ "content_{$duration}_3d" ] ?? 0 ),
            'videos_2d'      => intval( $s[ "content_{$duration}_2d_video" ] ?? 0 ),
            'videos_4d'      => intval( $s[ "content_{$duration}_4d_video" ] ?? 0 ),
            'prints_a4'      => intval( $s[ "content_{$duration}_a4" ] ?? 0 ),
            'prints_10x15'   => intval( $s[ "content_{$duration}_10x15" ] ?? 0 ),
            'usb_free'       => intval( $s[ "content_{$duration}_usb_free" ] ?? 0 ),
            'recording_free' => intval( $s[ "content_{$duration}_recording_free" ] ?? 0 ),
        );
    }

    /**
     * Calculate addon price for a single appointment.
     */
    public static function addon_total( $duration, $addons ) {
        $s     = self::settings();
        $rules = self::content_rules( $duration );
        $total = 0;

        // 3D extra (<30 min, only charged if 3D not included)
        if ( ! empty( $addons['add_3d'] ) && $rules['photos_3d'] === 0 ) {
            $total += floatval( $s['price_3d_extra'] ?? 15 );
        }

        // USB stick (only charged if not free at this duration)
        if ( ! empty( $addons['add_usb'] ) && ! $rules['usb_free'] ) {
            $total += floatval( $s['price_usb'] ?? 10 );
        }

        // Recording (only charged if not free, requires USB)
        if ( ! empty( $addons['add_recording'] ) && ! $rules['recording_free'] ) {
            $total += floatval( $s['price_recording'] ?? 30 );
        }

        // Extra prints
        $extra_a4 = intval( $addons['extra_a4'] ?? 0 );
        if ( $extra_a4 > 0 ) {
            $total += $extra_a4 * floatval( $s['price_extra_a4'] ?? 4 );
        }

        $extra_10x15 = intval( $addons['extra_10x15'] ?? 0 );
        if ( $extra_10x15 > 0 ) {
            $total += $extra_10x15 * floatval( $s['price_extra_10x15'] ?? 2 );
        }

        return round( $total, 2 );
    }

    /**
     * Package discount percentage.
     */
    public static function package_discount( $qty ) {
        if ( $qty >= 3 ) return 0.20;
        if ( $qty >= 2 ) return 0.10;
        return 0;
    }

    /**
     * Calculate total for a complete booking.
     *
     * @param array $appointments Array of appointment data.
     * @return array { subtotal, discount_pct, discount_amount, total }
     */
    public static function calculate_total( $appointments ) {
        $subtotal = 0;

        foreach ( $appointments as $appt ) {
            $duration = intval( $appt['duration'] ?? 10 );
            $addons   = $appt['addons'] ?? array();
            $time     = $appt['time'] ?? '12:00';
            $date     = $appt['date'] ?? date( 'Y-m-d' );

            $staff_id  = intval( $appt['staff_id'] ?? 0 );
            $base      = self::base_price( $duration );
            $surcharge = self::surcharge( $time, $date, $staff_id );
            $addon     = self::addon_total( $duration, $addons );

            $subtotal += $base + $surcharge + $addon;
        }

        $qty          = count( $appointments );
        $discount_pct = self::package_discount( $qty );
        $discount_amt = round( $subtotal * $discount_pct, 2 );
        $total        = round( $subtotal - $discount_amt, 2 );

        return array(
            'subtotal'        => $subtotal,
            'discount_pct'    => $discount_pct,
            'discount_amount' => $discount_amt,
            'total'           => $total,
        );
    }
}
