<?php
/**
 * EchoVisie Booking – Admin Settings Page
 *
 * Provides a WordPress admin interface for configuring Bookly integration.
 * All settings are stored in the wp_options table under the key 'echovisie_settings'.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/* =================================================================
   ADMIN MENU
   ================================================================= */

add_action( 'admin_menu', 'echovisie_admin_menu' );

function echovisie_admin_menu() {
    add_menu_page(
        'EchoVisie Instellingen',
        'EchoVisie',
        'manage_options',
        'echovisie-settings',
        'echovisie_settings_page',
        'dashicons-heart',
        80
    );
}

/* =================================================================
   REGISTER SETTINGS
   ================================================================= */

add_action( 'admin_init', 'echovisie_register_settings' );

function echovisie_register_settings() {
    register_setting( 'echovisie_settings_group', 'echovisie_settings', array(
        'type'              => 'array',
        'sanitize_callback' => 'echovisie_sanitize_settings',
        'default'           => echovisie_default_settings(),
    ) );

    /* --- Section: Services --- */
    add_settings_section(
        'echovisie_services_section',
        'Bookly Services',
        'echovisie_services_section_cb',
        'echovisie-settings'
    );

    $durations = array( 10, 20, 30, 40, 50, 60 );
    $prices    = array( 10 => 20, 20 => 35, 30 => 50, 40 => 65, 50 => 80, 60 => 95 );
    foreach ( $durations as $d ) {
        add_settings_field(
            'echovisie_service_' . $d,
            'Echo ' . $d . ' min',
            'echovisie_number_field_cb',
            'echovisie-settings',
            'echovisie_services_section',
            array(
                'key'         => 'service_' . $d,
                'description' => 'Bookly Service ID voor Echo ' . $d . ' min (&euro;' . $prices[ $d ] . ')',
            )
        );
    }

    /* --- Section: Extras --- */
    add_settings_section(
        'echovisie_extras_section',
        'Bookly Service Extras',
        'echovisie_extras_section_cb',
        'echovisie-settings'
    );

    $extras = array(
        'extra_small_photo' => array( 'label' => 'Extra kleine foto (print)', 'desc' => '&euro;2/stuk' ),
        'extra_large_photo' => array( 'label' => 'Extra grote foto (print)', 'desc' => '&euro;4/stuk' ),
        'recording'         => array( 'label' => 'Volledige opname',         'desc' => '&euro;30 (gratis vanaf 40 min)' ),
        'usb'               => array( 'label' => 'USB-stick (16 GB)',        'desc' => '&euro;10 (gratis vanaf 40 min)' ),
    );
    foreach ( $extras as $id => $info ) {
        add_settings_field(
            'echovisie_extra_' . $id,
            $info['label'],
            'echovisie_number_field_cb',
            'echovisie-settings',
            'echovisie_extras_section',
            array(
                'key'         => 'extra_' . $id,
                'description' => 'Bookly Extra ID &mdash; ' . $info['desc'],
            )
        );
    }

    /* --- Section: Staff --- */
    add_settings_section(
        'echovisie_staff_section',
        'Medewerkers',
        'echovisie_staff_section_cb',
        'echovisie-settings'
    );

    $staff = array(
        'ida'      => 'Ida Tjeerdsma',
        'christel' => 'Christel van den Heuvel',
        'rianne'   => 'Rianne Block',
    );
    foreach ( $staff as $key => $name ) {
        add_settings_field(
            'echovisie_staff_' . $key,
            $name,
            'echovisie_number_field_cb',
            'echovisie-settings',
            'echovisie_staff_section',
            array(
                'key'         => 'staff_' . $key,
                'description' => 'Bookly Staff ID voor ' . $name,
            )
        );
    }

    /* --- Section: Coupons --- */
    add_settings_section(
        'echovisie_coupons_section',
        'Pakketkortingen',
        'echovisie_coupons_section_cb',
        'echovisie-settings'
    );

    add_settings_field(
        'echovisie_coupon_2',
        'Pakket 2 afspraken',
        'echovisie_text_field_cb',
        'echovisie-settings',
        'echovisie_coupons_section',
        array(
            'key'         => 'coupon_2',
            'description' => 'Bookly-couponcode voor 10% korting (2 afspraken)',
            'placeholder' => 'PAKKET2',
        )
    );

    add_settings_field(
        'echovisie_coupon_3',
        'Pakket 3 afspraken',
        'echovisie_text_field_cb',
        'echovisie-settings',
        'echovisie_coupons_section',
        array(
            'key'         => 'coupon_3',
            'description' => 'Bookly-couponcode voor 20% korting (3 afspraken)',
            'placeholder' => 'PAKKET3',
        )
    );

    /* --- Section: Custom Fields --- */
    add_settings_section(
        'echovisie_custom_fields_section',
        'Bookly Custom Fields',
        'echovisie_custom_fields_section_cb',
        'echovisie-settings'
    );

    $custom_fields = array(
        'cf_pregnancy_week' => array( 'label' => 'Zwangerschapsweek',  'desc' => 'Bookly Custom Field ID voor &ldquo;Zwangerschapsweek bij afspraak&rdquo;' ),
        'cf_due_date'       => array( 'label' => 'Uitgerekende datum', 'desc' => 'Bookly Custom Field ID voor &ldquo;Uitgerekende datum&rdquo;' ),
        'cf_notes'          => array( 'label' => 'Opmerkingen',        'desc' => 'Bookly Custom Field ID voor &ldquo;Opmerkingen&rdquo;' ),
    );
    foreach ( $custom_fields as $id => $info ) {
        add_settings_field(
            'echovisie_' . $id,
            $info['label'],
            'echovisie_number_field_cb',
            'echovisie-settings',
            'echovisie_custom_fields_section',
            array(
                'key'         => $id,
                'description' => $info['desc'],
            )
        );
    }
}

/* =================================================================
   DEFAULTS
   ================================================================= */

function echovisie_default_settings() {
    return array(
        'service_10'         => 0,
        'service_20'         => 0,
        'service_30'         => 0,
        'service_40'         => 0,
        'service_50'         => 0,
        'service_60'         => 0,
        'extra_extra_small_photo' => 0,
        'extra_extra_large_photo' => 0,
        'extra_recording'    => 0,
        'extra_usb'          => 0,
        'staff_ida'          => 0,
        'staff_christel'     => 0,
        'staff_rianne'       => 0,
        'coupon_2'           => 'PAKKET2',
        'coupon_3'           => 'PAKKET3',
        'cf_pregnancy_week'  => 0,
        'cf_due_date'        => 0,
        'cf_notes'           => 0,
    );
}

/* =================================================================
   SANITIZE
   ================================================================= */

function echovisie_sanitize_settings( $input ) {
    $defaults  = echovisie_default_settings();
    $sanitized = array();

    foreach ( $defaults as $key => $default ) {
        if ( is_int( $default ) ) {
            $sanitized[ $key ] = isset( $input[ $key ] ) ? absint( $input[ $key ] ) : $default;
        } else {
            $sanitized[ $key ] = isset( $input[ $key ] ) ? sanitize_text_field( $input[ $key ] ) : $default;
        }
    }

    return $sanitized;
}

/* =================================================================
   SECTION CALLBACKS
   ================================================================= */

function echovisie_services_section_cb() {
    echo '<p>Koppel elke echo-duur aan een Bookly Service. Maak 6 services aan in <strong>Bookly &rarr; Services</strong> en vul hier de ID&rsquo;s in.</p>';
}

function echovisie_extras_section_cb() {
    echo '<p>Koppel de EchoVisie-extra&rsquo;s aan Bookly Service Extras. Maak deze aan in <strong>Bookly &rarr; Service Extras</strong> en koppel ze aan alle 6 echo-services.</p>';
}

function echovisie_staff_section_cb() {
    echo '<p>Koppel je medewerkers aan hun Bookly Staff Member ID. Je vindt het ID in <strong>Bookly &rarr; Staff Members</strong> &rarr; klik op de medewerker &rarr; check de URL voor <code>?id=X</code>.</p>';
}

function echovisie_coupons_section_cb() {
    echo '<p>Maak kortingscoupons aan in <strong>Bookly &rarr; Coupons</strong> en vul de codes hieronder in.</p>';
}

function echovisie_custom_fields_section_cb() {
    echo '<p>Maak custom fields aan in <strong>Bookly &rarr; Custom Fields</strong> en vul hier de ID&rsquo;s in. Dit is optioneel &mdash; laat op 0 staan als je dit niet gebruikt.</p>';
}

/* =================================================================
   FIELD CALLBACKS
   ================================================================= */

function echovisie_get_setting( $key ) {
    $settings = get_option( 'echovisie_settings', echovisie_default_settings() );
    $defaults = echovisie_default_settings();
    return isset( $settings[ $key ] ) ? $settings[ $key ] : ( $defaults[ $key ] ?? '' );
}

function echovisie_number_field_cb( $args ) {
    $key   = $args['key'];
    $value = echovisie_get_setting( $key );
    $desc  = $args['description'] ?? '';

    printf(
        '<input type="number" name="echovisie_settings[%s]" value="%s" min="0" class="small-text" />',
        esc_attr( $key ),
        esc_attr( $value )
    );

    if ( $desc ) {
        printf( '<p class="description">%s</p>', $desc );
    }
}

function echovisie_text_field_cb( $args ) {
    $key         = $args['key'];
    $value       = echovisie_get_setting( $key );
    $desc        = $args['description'] ?? '';
    $placeholder = $args['placeholder'] ?? '';

    printf(
        '<input type="text" name="echovisie_settings[%s]" value="%s" placeholder="%s" class="regular-text" />',
        esc_attr( $key ),
        esc_attr( $value ),
        esc_attr( $placeholder )
    );

    if ( $desc ) {
        printf( '<p class="description">%s</p>', $desc );
    }
}

/* =================================================================
   SETTINGS PAGE RENDER
   ================================================================= */

function echovisie_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    $settings = get_option( 'echovisie_settings', echovisie_default_settings() );

    // Check Bookly availability
    $bookly_active = class_exists( '\Bookly\Lib\Entities\Service' );
    ?>
    <div class="wrap">
        <h1>EchoVisie Instellingen</h1>

        <?php if ( ! $bookly_active ) : ?>
        <div class="notice notice-warning">
            <p><strong>Bookly is niet gedetecteerd.</strong> Installeer en activeer <em>Bookly</em> om de volledige integratie te gebruiken. De configurator werkt standalone, maar tijdsloten en boekingen vereisen Bookly.</p>
        </div>
        <?php else : ?>
        <div class="notice notice-success">
            <p><strong>Bookly is actief.</strong> Vul hieronder de juiste ID&rsquo;s in om de koppeling te voltooien.</p>
        </div>
        <?php endif; ?>

        <?php settings_errors(); ?>

        <form method="post" action="options.php">
            <?php
            settings_fields( 'echovisie_settings_group' );
            do_settings_sections( 'echovisie-settings' );
            submit_button( 'Instellingen opslaan' );
            ?>
        </form>

        <hr>
        <h2>Shortcodes</h2>
        <table class="widefat" style="max-width:600px;">
            <tbody>
                <tr>
                    <td><code>[echovisie_booking]</code></td>
                    <td>Toont de echo-configurator met directe Bookly-boeking op een pagina.</td>
                </tr>
            </tbody>
        </table>

        <?php if ( $bookly_active ) : ?>
        <hr>
        <h2>Bookly Quick Lookup</h2>
        <p>Klik op de links hieronder om snel ID&rsquo;s op te zoeken:</p>
        <ul style="list-style:disc;padding-left:20px;">
            <li><a href="<?php echo esc_url( admin_url( 'admin.php?page=bookly-services' ) ); ?>">Bookly &rarr; Services</a> (voor Service ID&rsquo;s)</li>
            <li><a href="<?php echo esc_url( admin_url( 'admin.php?page=bookly-staff' ) ); ?>">Bookly &rarr; Staff Members</a> (voor Staff ID&rsquo;s)</li>
            <li><a href="<?php echo esc_url( admin_url( 'admin.php?page=bookly-coupons' ) ); ?>">Bookly &rarr; Coupons</a> (voor kortingscodes)</li>
        </ul>
        <?php endif; ?>
    </div>
    <?php
}

/* =================================================================
   SETTINGS LINK ON PLUGINS PAGE
   ================================================================= */

add_filter( 'plugin_action_links_' . plugin_basename( dirname( __DIR__ ) . '/echovisie-booking.php' ), 'echovisie_plugin_action_links' );

function echovisie_plugin_action_links( $links ) {
    $settings_link = '<a href="' . esc_url( admin_url( 'admin.php?page=echovisie-settings' ) ) . '">Instellingen</a>';
    array_unshift( $links, $settings_link );
    return $links;
}
