<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class EchoVisie_Admin {

    private static $instance = null;

    public static function init() {
        if ( self::$instance === null ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action( 'admin_menu', array( $this, 'add_menu' ) );
        add_action( 'admin_init', array( $this, 'register_settings' ) );
    }

    public function add_menu() {
        add_menu_page(
            'EchoVisie Instellingen',
            'EchoVisie',
            'manage_options',
            'echovisie-settings',
            array( $this, 'render_page' ),
            'dashicons-heart',
            30
        );
    }

    public function register_settings() {
        register_setting( 'echovisie_settings_group', 'echovisie_settings', array(
            'sanitize_callback' => array( $this, 'sanitize' ),
        ) );
    }

    public function sanitize( $input ) {
        $clean = array();
        $defaults = echovisie_default_settings();

        foreach ( $defaults as $key => $default ) {
            if ( isset( $input[ $key ] ) ) {
                if ( is_numeric( $default ) ) {
                    $clean[ $key ] = is_float( $default + 0 ) ? floatval( $input[ $key ] ) : intval( $input[ $key ] );
                } else {
                    $clean[ $key ] = sanitize_text_field( $input[ $key ] );
                }
            } else {
                // Checkboxes: unchecked = not in POST
                if ( in_array( $key, $this->get_checkbox_keys(), true ) ) {
                    $clean[ $key ] = 0;
                } else {
                    $clean[ $key ] = $default;
                }
            }
        }

        return $clean;
    }

    private function get_checkbox_keys() {
        $keys = array( 'weekend_surcharge' );
        foreach ( array( 10, 20, 30, 40, 50, 60 ) as $dur ) {
            $keys[] = "content_{$dur}_usb_free";
            $keys[] = "content_{$dur}_recording_free";
        }
        return $keys;
    }

    public function render_page() {
        $s = get_option( 'echovisie_settings', echovisie_default_settings() );
        $active_tab = isset( $_GET['tab'] ) ? sanitize_key( $_GET['tab'] ) : 'prijzen';
        ?>
        <div class="wrap">
            <h1>EchoVisie Instellingen</h1>

            <!-- Instructies -->
            <div class="notice notice-info" style="padding:12px 16px;">
                <h3 style="margin-top:0;">Bookly ID's opzoeken</h3>
                <ul style="list-style:disc;margin-left:20px;">
                    <li><strong>Service ID:</strong> Ga naar <em>Bookly &gt; Services</em>, klik op een service. Het ID staat in de URL: <code>admin.php?page=bookly-services&id=<strong>X</strong></code></li>
                    <li><strong>Staff ID:</strong> Ga naar <em>Bookly &gt; Medewerkers</em>, klik op een medewerker. Het ID staat in de URL: <code>admin.php?page=bookly-staff&id=<strong>X</strong></code></li>
                    <li><strong>Custom Field ID:</strong> Ga naar <em>Bookly &gt; Instellingen &gt; Custom Fields</em>. Het veld-ID is zichtbaar naast elk veld.</li>
                    <li><strong>Coupon:</strong> Ga naar <em>Bookly &gt; Instellingen &gt; Coupons</em>. Maak coupons aan met 10% (2-pakket) en 20% (3-pakket) korting.</li>
                </ul>
                <p>Shortcode: <code>[echovisie_booking]</code> — Plaats deze op een pagina om het boekingsformulier te tonen.</p>
            </div>

            <h2 class="nav-tab-wrapper">
                <?php
                $tabs = array(
                    'prijzen'  => 'Prijzen',
                    'inhoud'   => 'Inhoud per duur',
                    'bookly'   => 'Bookly Koppeling',
                );
                foreach ( $tabs as $slug => $label ) {
                    $class = $active_tab === $slug ? ' nav-tab-active' : '';
                    printf(
                        '<a href="%s" class="nav-tab%s">%s</a>',
                        esc_url( add_query_arg( 'tab', $slug, admin_url( 'admin.php?page=echovisie-settings' ) ) ),
                        $class,
                        esc_html( $label )
                    );
                }
                ?>
            </h2>

            <form method="post" action="options.php">
                <?php settings_fields( 'echovisie_settings_group' ); ?>

                <?php // Always render hidden fields for all settings to prevent data loss ?>
                <?php $this->render_hidden_fields( $s, $active_tab ); ?>

                <?php if ( $active_tab === 'prijzen' ) : ?>
                    <?php $this->render_tab_prijzen( $s ); ?>
                <?php elseif ( $active_tab === 'inhoud' ) : ?>
                    <?php $this->render_tab_inhoud( $s ); ?>
                <?php elseif ( $active_tab === 'bookly' ) : ?>
                    <?php $this->render_tab_bookly( $s ); ?>
                <?php endif; ?>

                <?php submit_button( 'Instellingen opslaan' ); ?>
            </form>
        </div>
        <?php
    }

    /**
     * Render hidden fields for tabs that are NOT currently active,
     * so their values are preserved on save.
     */
    private function render_hidden_fields( $s, $active_tab ) {
        $prijzen_keys = array(
            'price_per_block', 'surcharge_amount', 'price_3d_extra',
            'price_usb', 'price_recording', 'price_extra_a4', 'price_extra_10x15',
            'daytime_end_hour', 'weekend_surcharge',
        );

        $inhoud_keys = array();
        foreach ( array( 10, 20, 30, 40, 50, 60 ) as $dur ) {
            foreach ( array( '2d', '3d', '2d_video', '4d_video', 'a4', '10x15', 'usb_free', 'recording_free' ) as $field ) {
                $inhoud_keys[] = "content_{$dur}_{$field}";
            }
        }

        $bookly_keys = array(
            'service_id_10', 'service_id_20', 'service_id_30',
            'service_id_40', 'service_id_50', 'service_id_60',
            'staff_1_name', 'staff_1_id', 'staff_2_name', 'staff_2_id',
            'staff_3_name', 'staff_3_id',
            'cf_pregnancy_week', 'cf_due_date', 'cf_notes',
            'coupon_2pack', 'coupon_3pack',
        );

        $tabs_keys = array(
            'prijzen' => $prijzen_keys,
            'inhoud'  => $inhoud_keys,
            'bookly'  => $bookly_keys,
        );

        foreach ( $tabs_keys as $tab => $keys ) {
            if ( $tab === $active_tab ) continue;
            foreach ( $keys as $key ) {
                printf(
                    '<input type="hidden" name="echovisie_settings[%s]" value="%s">',
                    esc_attr( $key ),
                    esc_attr( $s[ $key ] ?? '' )
                );
            }
        }
    }

    /* ── Tab: Prijzen ─────────────────────────────────── */
    private function render_tab_prijzen( $s ) {
        ?>
        <table class="form-table">
            <?php
            $this->number_row( 'Prijs per 10 minuten (&euro;)', 'price_per_block', $s, 0, 200, 0.5 );
            $this->number_row( 'Avond/weekend toeslag (&euro;)', 'surcharge_amount', $s, 0, 100, 0.5 );
            $this->number_row( 'Meerprijs 3D beelden &lt;30 min (&euro;)', 'price_3d_extra', $s, 0, 100, 0.5 );
            $this->number_row( 'Meerprijs USB-stick &lt;40 min (&euro;)', 'price_usb', $s, 0, 50, 0.5 );
            $this->number_row( 'Meerprijs opname &lt;40 min (&euro;)', 'price_recording', $s, 0, 100, 0.5 );
            $this->number_row( 'Extra A4 afdruk (&euro;/stuk)', 'price_extra_a4', $s, 0, 50, 0.5 );
            $this->number_row( 'Extra 10&times;15 afdruk (&euro;/stuk)', 'price_extra_10x15', $s, 0, 50, 0.5 );
            $this->number_row( 'Einde dagtarief (uur)', 'daytime_end_hour', $s, 12, 22, 1 );
            ?>
            <tr>
                <th>Weekend-toeslag actief</th>
                <td>
                    <label>
                        <input type="checkbox" name="echovisie_settings[weekend_surcharge]" value="1"
                            <?php checked( 1, intval( $s['weekend_surcharge'] ?? 1 ) ); ?>>
                        Toeslag ook op zaterdag en zondag
                    </label>
                </td>
            </tr>
        </table>
        <?php
    }

    /* ── Tab: Inhoud per duur ─────────────────────────── */
    private function render_tab_inhoud( $s ) {
        $durations = array( 10, 20, 30, 40, 50, 60 );
        $fields = array(
            '2d'             => 'Min. 2D beelden',
            '3d'             => 'Min. 3D beelden',
            '2d_video'       => 'Min. 2D video\'s',
            '4d_video'       => 'Min. 4D video\'s',
            'a4'             => 'Afdrukken A4',
            '10x15'          => 'Afdrukken 10&times;15',
            'usb_free'       => 'USB gratis',
            'recording_free' => 'Opname gratis',
        );
        $checkbox_fields = array( 'usb_free', 'recording_free' );
        ?>
        <p class="description">Stel hieronder het minimale aantal inbegrepen items in per echo-duur. Geslachtsbepaling is altijd gratis inbegrepen (alle duren).</p>
        <table class="widefat fixed striped" style="max-width:900px;">
            <thead>
                <tr>
                    <th style="width:160px;">Veld</th>
                    <?php foreach ( $durations as $dur ) : ?>
                        <th style="text-align:center;"><?php echo esc_html( $dur ); ?> min</th>
                    <?php endforeach; ?>
                </tr>
            </thead>
            <tbody>
                <?php foreach ( $fields as $field_key => $label ) : ?>
                    <tr>
                        <td><strong><?php echo $label; ?></strong></td>
                        <?php foreach ( $durations as $dur ) :
                            $name = "echovisie_settings[content_{$dur}_{$field_key}]";
                            $val = $s[ "content_{$dur}_{$field_key}" ] ?? 0;
                            ?>
                            <td style="text-align:center;">
                                <?php if ( in_array( $field_key, $checkbox_fields, true ) ) : ?>
                                    <input type="checkbox" name="<?php echo esc_attr( $name ); ?>" value="1"
                                        <?php checked( 1, intval( $val ) ); ?>>
                                <?php else : ?>
                                    <input type="number" name="<?php echo esc_attr( $name ); ?>"
                                        value="<?php echo esc_attr( intval( $val ) ); ?>"
                                        min="0" max="100" step="1"
                                        style="width:60px;text-align:center;">
                                <?php endif; ?>
                            </td>
                        <?php endforeach; ?>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php
    }

    /* ── Tab: Bookly Koppeling ────────────────────────── */
    private function render_tab_bookly( $s ) {
        ?>
        <h3>Service ID's</h3>
        <p class="description">Vul hieronder de Bookly Service ID's in voor elke echo-duur.</p>
        <table class="form-table">
            <?php
            foreach ( array( 10, 20, 30, 40, 50, 60 ) as $dur ) {
                $this->text_row( "Service ID {$dur} min", "service_id_{$dur}", $s );
            }
            ?>
        </table>

        <h3>Medewerkers</h3>
        <p class="description">Vul naam en Bookly Staff ID in per medewerker.</p>
        <table class="form-table">
            <?php for ( $i = 1; $i <= 3; $i++ ) : ?>
                <tr>
                    <th>Medewerker <?php echo $i; ?></th>
                    <td>
                        <input type="text" name="echovisie_settings[staff_<?php echo $i; ?>_name]"
                            value="<?php echo esc_attr( $s[ "staff_{$i}_name" ] ?? '' ); ?>"
                            placeholder="Naam" style="width:200px;">
                        <input type="number" name="echovisie_settings[staff_<?php echo $i; ?>_id]"
                            value="<?php echo esc_attr( $s[ "staff_{$i}_id" ] ?? '' ); ?>"
                            placeholder="Bookly ID" style="width:100px;" min="0">
                    </td>
                </tr>
            <?php endfor; ?>
        </table>

        <h3>Custom Field ID's</h3>
        <table class="form-table">
            <?php
            $this->text_row( 'Zwangerschapsweek veld', 'cf_pregnancy_week', $s );
            $this->text_row( 'Uitgerekende datum veld', 'cf_due_date', $s );
            $this->text_row( 'Opmerkingen veld', 'cf_notes', $s );
            ?>
        </table>

        <h3>Coupon Codes</h3>
        <p class="description">Maak in Bookly coupons aan met de juiste kortingspercentages en vul de codes hieronder in.</p>
        <table class="form-table">
            <?php
            $this->text_row( '2-pakket korting (10%)', 'coupon_2pack', $s );
            $this->text_row( '3-pakket korting (20%)', 'coupon_3pack', $s );
            ?>
        </table>
        <?php
    }

    /* ── Helper renderers ─────────────────────────────── */
    private function number_row( $label, $key, $s, $min = 0, $max = 999, $step = 1 ) {
        ?>
        <tr>
            <th><?php echo $label; ?></th>
            <td>
                <input type="number" name="echovisie_settings[<?php echo esc_attr( $key ); ?>]"
                    value="<?php echo esc_attr( $s[ $key ] ?? 0 ); ?>"
                    min="<?php echo esc_attr( $min ); ?>"
                    max="<?php echo esc_attr( $max ); ?>"
                    step="<?php echo esc_attr( $step ); ?>"
                    style="width:100px;">
            </td>
        </tr>
        <?php
    }

    private function text_row( $label, $key, $s ) {
        ?>
        <tr>
            <th><?php echo esc_html( $label ); ?></th>
            <td>
                <input type="text" name="echovisie_settings[<?php echo esc_attr( $key ); ?>]"
                    value="<?php echo esc_attr( $s[ $key ] ?? '' ); ?>"
                    class="regular-text">
            </td>
        </tr>
        <?php
    }
}

EchoVisie_Admin::init();
