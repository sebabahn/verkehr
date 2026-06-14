<?php
// proxy.php - Erweiterter Waze JSON-Proxy für Feuerwehr-Dashboard

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
//header('Cache-Control: public, max-age=5');   // 90 Sekunden Cache

header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

// === Deine feste Feed-URL ===
$source_url = 'https://www.waze.com/row-partnerhub-api/partners/11640014449/waze-feeds/b0f6256e-db98-410b-b5c0-5df952962e64?format=1';

// Erweiterte Parameter (hier kannst du filtern)
$query_params = [
    'format' => '1',
    // 'types' => 'alerts,jams,irregularities',     // alle Typen (Standard)
    // 'alerts' => 'accident,road_closed,hazard',   // nur bestimmte Alerts
    'thumbsup' => 'true'                           // Thumbs-Up Anzahl mitliefern
];

$full_url = $source_url . '&' . http_build_query($query_params);

// Optional: ETag für besseres Caching
$if_none_match = $_SERVER['HTTP_IF_NONE_MATCH'] ?? '';
$our_etag = '"' . md5($full_url . date('Y-m-d\TH')) . '"';

if ($if_none_match === $our_etag) {
    http_response_code(304);
    exit;
}
header('ETag: ' . $our_etag);

// User-Agent (wichtig, damit Waze nicht blockt)
$context = stream_context_create([
    'http' => [
        'method'        => 'GET',
        'header'        => "User-Agent: Waze-JSON-Proxy/1.3 (Feuerwehr Oberndorf Dashboard)\r\n" .
                           "Accept: application/json\r\n",
        'timeout'       => 12,
        'follow_location'=> true,
        'max_redirects' => 5,
        'ignore_errors' => true,
    ]
]);

$content = @file_get_contents($full_url, false, $context);

if ($content === false) {
    $error = error_get_last();
    http_response_code(502);
    echo json_encode([
        'error'   => 'could_not_fetch',
        'message' => 'Fehler beim Abruf des Waze-Feeds',
        'details' => $error['message'] ?? 'Unbekannter Fehler',
        'url'     => $full_url,
        'time'    => date('c')
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// Original-Statuscode weiterleiten
$http_response_header_lines = $http_response_header ?? [];
foreach ($http_response_header_lines as $line) {
    if (preg_match('#^HTTP/\d\.\d\s+(\d{3})#', $line, $m)) {
        http_response_code((int)$m[1]);
        break;
    }
}

// JSON direkt ausgeben
echo $content;
exit;