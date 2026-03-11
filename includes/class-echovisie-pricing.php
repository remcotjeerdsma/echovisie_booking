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
        $per_block = floatval( $s['price_per_block'] ?? 15 );
        return $per_block * ( $duration / 10 );
    }

    /**
     * Surcharge for evening/weekend.
     */
    public static function surcharge( $time_str, $date_str ) {
        $s = self::settings();
        $amount   = floatval( $s['surcharge_amount'] ?? 10 );
        $end_hour = intval( $s['daytime_end_hour'] ?? 17 );
        $weekend  = intval( $s['weekend_surcharge'] ?? 1 );

        $tz   = wp_timezone();
        $dt   = new DateTime( $date_str . ' ' . $time_str, $tz );
        $hour = intval( $dt->format( 'G' ) );
        $dow  = intval( $dt->format( 'N' ) ); // 1=Mon, 7=Sun

        if ( $hour >= $end_hour ) {
            return $amount;
        }
        if ( $weekend && ( $dow === 6 || $dow === 7 ) ) {
            return $amount;
        }
        return 0;
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

            $base      = self::base_price( $duration );
            $surcharge = self::surcharge( $time, $date );
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
