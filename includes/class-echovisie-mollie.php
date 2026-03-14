<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Thin Mollie API v2 wrapper using the WordPress HTTP API.
 * No external SDK required — uses wp_remote_post / wp_remote_get.
 */
class EchoVisie_Mollie {

    const API_BASE = 'https://api.mollie.com/v2/';

    /** @var string */
    private $api_key;

    public function __construct( string $api_key ) {
        $this->api_key = $api_key;
    }

    /* ── Payment creation ─────────────────────────────── */

    /**
     * Create a Mollie payment.
     *
     * @param float  $amount       Amount in major units (e.g. 45.00)
     * @param string $currency     ISO 4217 (default EUR)
     * @param string $description  Shown on Mollie checkout (max 255 chars)
     * @param string $redirect_url Where Mollie sends the customer after payment
     * @param string $webhook_url  Where Mollie POSTs async status updates (optional)
     * @param array  $metadata     Arbitrary key-value pairs stored with the payment
     * @return object Mollie payment object
     * @throws Exception on API or network errors
     */
    public function create_payment(
        float  $amount,
        string $currency,
        string $description,
        string $redirect_url,
        string $webhook_url = '',
        array  $metadata    = array()
    ): object {
        $zero_decimal = in_array( $currency, array( 'ISK', 'JPY' ), true );

        $body = array(
            'amount'      => array(
                'currency' => $currency,
                'value'    => number_format( $amount, $zero_decimal ? 0 : 2, '.', '' ),
            ),
            'description' => mb_substr( $description, 0, 255 ),
            'redirectUrl' => $redirect_url,
            'metadata'    => $metadata,
        );

        if ( $webhook_url ) {
            $body['webhookUrl'] = $webhook_url;
        }

        return $this->request( 'POST', 'payments', $body );
    }

    /**
     * Retrieve a Mollie payment by its ID (tr_xxxxxx).
     *
     * @throws Exception
     */
    public function get_payment( string $payment_id ): object {
        return $this->request( 'GET', 'payments/' . rawurlencode( $payment_id ) );
    }

    /* ── Status helpers ───────────────────────────────── */

    /** Returns true when the payment has been successfully paid. */
    public static function is_paid( object $payment ): bool {
        return ! empty( $payment->paidAt ) || ( $payment->status ?? '' ) === 'paid';
    }

    /** Returns true when the payment is still open or pending processing. */
    public static function is_pending( object $payment ): bool {
        return in_array( $payment->status ?? '', array( 'open', 'pending' ), true );
    }

    /** Extract the hosted checkout URL from a freshly-created payment object. */
    public static function checkout_url( object $payment ): string {
        return $payment->_links->checkout->href ?? '';
    }

    /* ── Internal HTTP helper ─────────────────────────── */

    private function request( string $method, string $endpoint, array $body = array() ): object {
        $args = array(
            'timeout' => 25,
            'headers' => array(
                'Accept'        => 'application/json',
                'Authorization' => 'Bearer ' . $this->api_key,
            ),
        );

        if ( $method === 'POST' ) {
            $args['headers']['Content-Type'] = 'application/json';
            $args['body']                    = wp_json_encode( $body );
            $response                        = wp_remote_post( self::API_BASE . $endpoint, $args );
        } else {
            $response = wp_remote_get( self::API_BASE . $endpoint, $args );
        }

        if ( is_wp_error( $response ) ) {
            throw new \Exception( 'Mollie: ' . $response->get_error_message() );
        }

        $status_code = (int) wp_remote_retrieve_response_code( $response );
        $parsed      = json_decode( wp_remote_retrieve_body( $response ) );

        if ( $status_code >= 300 || empty( $parsed ) ) {
            $detail = $parsed->detail ?? $parsed->message ?? "HTTP {$status_code}";
            throw new \Exception( 'Mollie: ' . $detail );
        }

        return $parsed;
    }
}
