<?php
session_start();

/**
 * Set CORS headers for cross-origin requests.
 */
header("Access-Control-Allow-Origin: " . ($_SERVER['HTTP_ORIGIN'] ?? '*'));
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, X-CSRF-TOKEN");
header("Access-Control-Expose-Headers: X-CSRF-TOKEN");
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Load database config
$base_dir = __DIR__;
require_once $base_dir . '/config/database.php';

/**
 * @var array $input User input from JSON POST body.
 */
$input = json_decode(file_get_contents("php://input"), true);

/**
 * @var string $modelType Forecast model type to use ('piecewise', 'linear', etc.).
 */
$modelType = $input['model_type'] ?? 'piecewise';

/**
 * @var int $months Number of months to forecast.
 */
$months = (int)($input['months'] ?? 30);

/**
 * @var array $rollout Initial user rollout numbers for first 6 months.
 */
$rollout = $input['rollout'] ?? [7500, 22500, 45000, 50000, 65000, 60000];

/**
 * @var int $linear_growth Monthly user growth for linear model.
 */
$linear_growth = (int)($input['linear_growth'] ?? 58333);

/**
 * @var int $exp_start Starting users for exponential model.
 */
$exp_start = (int)($input['exp_start'] ?? 600000);

/**
 * @var float $exp_rate Exponential growth rate.
 */
$exp_rate = (float)($input['exp_rate'] ?? 0.15);

/**
 * @var float $a Quadratic coefficient for polynomial model.
 * @var float $b Linear coefficient for polynomial model.
 * @var float $c Constant coefficient for polynomial model.
 */
$a = (float)($input['a'] ?? 1000);
$b = (float)($input['b'] ?? 30000);
$c = (float)($input['c'] ?? 0);

/**
 * @var int $L Carrying capacity for logistic model.
 * @var float $k Growth rate for logistic model.
 * @var int $t0 Inflection point for logistic model.
 */
$L = (int)($input['L'] ?? 1000000);
$k = (float)($input['k'] ?? 0.3);
$t0 = (int)($input['t0'] ?? 12);

/**
 * @var float $revA_pro Revenue per Pro user (current split).
 * @var float $revA_family Revenue per Family user (current split).
 * @var float $revB_pro Revenue per Pro user (projected split).
 * @var float $revB_family Revenue per Family user (projected split).
 */
$revA_pro = (float)($input['revA_pro'] ?? 0.12);
$revA_family = (float)($input['revA_family'] ?? 0.04);
$revB_pro = (float)($input['revB_pro'] ?? 0.75);
$revB_family = (float)($input['revB_family'] ?? 0.05);

/**
 * @var int $cf_start Starting cash flow per month.
 * @var int $cf_step Cash flow increment per month.
 */
$cf_start = (int)($input['cf_start'] ?? 15000);
$cf_step = (int)($input['cf_step'] ?? 10000);

/**
 * @var float $price_pro Price per Pro subscription.
 * @var float $price_family Price per Family subscription.
 */
$price_pro = isset($input['price_pro']) ? (float)$input['price_pro'] : 5.99;
$price_family = isset($input['price_family']) ? (float)$input['price_family'] : 11.99;

/**
 * Linear forecast model.
 * @param int $start Starting users.
 * @param int $months Number of months.
 * @param int $growth Users added per month.
 * @return array Forecasted user data per month.
 */
function linear_forecast($start, $months, $growth) {
    $data = [];
    $cum = $start;
    for ($i = 1; $i <= $months; $i++) {
        $cum += $growth;
        $data[] = ['month' => $i, 'users' => $growth, 'cumulative' => $cum];
    }
    return $data;
}

/**
 * Exponential forecast model.
 * @param int $start Starting users.
 * @param int $months Number of months.
 * @param float $rate Exponential growth rate.
 * @return array Forecasted user data per month.
 */
function exponential_forecast($start, $months, $rate) {
    $data = [];
    for ($i = 1; $i <= $months; $i++) {
        $curr = $start * exp($rate * $i);
        $prev = $start * exp($rate * ($i - 1));
        $users = round($curr - $prev);
        $data[] = ['month' => $i, 'users' => $users, 'cumulative' => round($curr)];
    }
    return $data;
}

/**
 * Piecewise forecast model (custom for this business).
 * @param array $rollout Initial rollout numbers.
 * @param int $linear_growth Monthly growth after rollout.
 * @param int $exp_start Starting users for exponential phase.
 * @param float $exp_rate Exponential growth rate.
 * @param int $months Number of months.
 * @return array Forecasted user data per month.
 */
function piecewise_forecast($rollout, $linear_growth, $exp_start, $exp_rate, $months) {
    $data = [];
    $cum = 0;
    for ($m = 1; $m <= $months; $m++) {
        if ($m <= 6) {
            $users = $rollout[$m - 1] ?? 0;
            $cum += $users;
        } elseif ($m <= 12) {
            $users = $linear_growth;
            $cum += $users;
        } else {
            $prev = $exp_start * exp($exp_rate * ($m - 13));
            $curr = $exp_start * exp($exp_rate * ($m - 12));
            $users = round($curr - $prev);
            $cum = round($curr);
        }
        $data[] = ['month' => $m, 'users' => $users, 'cumulative' => $cum];
    }
    return $data;
}

/**
 * Polynomial (quadratic) forecast model.
 * @param int $start Starting users.
 * @param int $months Number of months.
 * @param float $a Quadratic coefficient.
 * @param float $b Linear coefficient.
 * @param float $c Constant coefficient.
 * @return array Forecasted user data per month.
 */
function polynomial_forecast($start, $months, $a, $b, $c) {
    $data = [];
    for ($i = 1; $i <= $months; $i++) {
        $users = round($a * pow($i, 2) + $b * $i + $c);
        $cum = ($i == 1) ? $users : $data[$i - 2]['cumulative'] + $users;
        $data[] = ['month' => $i, 'users' => $users, 'cumulative' => $cum];
    }
    return $data;
}

/**
 * Logistic (S-curve) forecast model.
 * @param int $L Carrying capacity.
 * @param float $k Growth rate.
 * @param int $t0 Inflection point.
 * @param int $months Number of months.
 * @return array Forecasted user data per month.
 */
function logistic_forecast($L, $k, $t0, $months) {
    $data = [];
    $prev_cum = 0;
    for ($i = 1; $i <= $months; $i++) {
        $cum = $L / (1 + exp(-$k * ($i - $t0)));
        $users = round($cum - $prev_cum);
        $data[] = ['month' => $i, 'users' => $users, 'cumulative' => round($cum)];
        $prev_cum = $cum;
    }
    return $data;
}

/**
 * @var array $growthData Forecasted user data for each month, based on selected model.
 */
switch ($modelType) {
    case 'linear':
        $growthData = linear_forecast(0, $months, $linear_growth);
        break;
    case 'polynomial':
        $growthData = polynomial_forecast(0, $months, $a, $b, $c);
        break;
    case 'exponential':
        $growthData = exponential_forecast(10000, $months, $exp_rate);
        break;
    case 'logistic':
        $growthData = logistic_forecast($L, $k, $t0, $months);
        break;
    case 'piecewise':
    default:
        $growthData = piecewise_forecast($rollout, $linear_growth, $exp_start, $exp_rate, $months);
        break;
}

/**
 * @var array $forecast Final forecast data including cash flow and revenue splits.
 */
$forecast = [];

// Read user input for percentages and prices for dynamic label generation
$Pro_Users_12_perc   = isset($input['Pro_Users_12_perc'])   ? (float)$input['Pro_Users_12_perc']   : 12;
$Pro_Users_5_99_price = isset($input['Pro_Users_5_99_price']) ? (float)$input['Pro_Users_5_99_price'] : 5.99;
$Family_Users_4_perc = isset($input['Family_Users_4_perc']) ? (float)$input['Family_Users_4_perc'] : 4;
$Family_Users_11_99_price = isset($input['Family_Users_11_99_price']) ? (float)$input['Family_Users_11_99_price'] : 11.99;
$Pro_Users_75_perc   = isset($input['Pro_Users_75_perc'])   ? (float)$input['Pro_Users_75_perc']   : 75;
$Family_Users_5_perc = isset($input['Family_Users_5_perc']) ? (float)$input['Family_Users_5_perc'] : 5;

// Compose dynamic keys for forecast output
$label_pro_12   = 'Pro '    . $Pro_Users_12_perc   . '% @ ' . $Pro_Users_5_99_price;
$label_family_4 = 'Family ' . $Family_Users_4_perc . '% @ ' . $Family_Users_11_99_price;
$label_pro_75   = 'Pro '    . $Pro_Users_75_perc   . '% @ ' . $Pro_Users_5_99_price;
$label_family_5 = 'Family ' . $Family_Users_5_perc . '% @ ' . $Family_Users_11_99_price;

// Read override values for month 6 from user input (fallback to defaults)
$const_pro_12   = isset($input['const_pro_12'])   ? (float)$input['const_pro_12']   : 30000.00;
$const_family_4 = isset($input['const_family_4']) ? (float)$input['const_family_4'] : 20000.00;
$const_pro_75   = isset($input['const_pro_75'])   ? (float)$input['const_pro_75']   : 187187.50;
$const_family_5 = isset($input['const_family_5']) ? (float)$input['const_family_5'] : 24970.17;

for ($i = 0; $i < count($growthData); $i++) {
    $row = $growthData[$i];
    $m = $row['month'];
    $users = $row['users'];

    $cf_month = $cf_start + ($m - 1) * $cf_step;
    $cf_year = $cf_month * 12;
    $loan_capacity = $cf_year * 0.8 * 7.47;

    // Revenue splits
    if ($m == 6) {
        $A_pro    = $const_pro_12;
        $A_family = $const_family_4;
        $B_pro    = $const_pro_75;
        $B_family = $const_family_5;
    } else {
        $A_pro    = round($users * $revA_pro * $price_pro, 2);
        $A_family = round($users * $revA_family * $price_family, 2);
        $B_pro    = round($users * $revB_pro * $price_pro, 2);
        $B_family = round($users * $revB_family * $price_family, 2);
    }

    $forecast[] = [
        "months" => $m,
        "users per month" => $users,
        "Cash Flow (\$/month)" => round($cf_month, 2),
        "Cash Flow (\$/year)" => round($cf_year, 2),
        "Estimated Loan Capacity (\$)" => round($loan_capacity, 2),
        $label_pro_12   => $A_pro,
        $label_family_4 => $A_family,
        $label_pro_75   => $B_pro,
        $label_family_5 => $B_family
    ];
}

/**
 * @var Database $db Database connection instance.
 * @var mysqli $conn MySQLi connection resource.
 */
$db = new Database();
$conn = $db->connect();

/**
 * Insert or update forecast data into the consolidated_cash_flow_projections table.
 */
foreach ($forecast as $row) {
    $sql = "
        INSERT INTO consolidated_cash_flow_projections (
            Month, CashFlow_Month, CashFlow_Year, EstimatedLoanCapacity, UsersPerMonth,
            Pro_Users_12, Family_Users_4, Pro_Users_75, Family_Users_5
        ) VALUES (
            {$row['months']}, {$row['Cash Flow ($/month)']}, {$row['Cash Flow ($/year)']}, {$row['Estimated Loan Capacity ($)']}, {$row['users per month']},
            {$row[$label_pro_12]}, {$row[$label_family_4]},
            {$row[$label_pro_75]}, {$row[$label_family_5]}
        )
        ON DUPLICATE KEY UPDATE
            CashFlow_Month=VALUES(CashFlow_Month),
            CashFlow_Year=VALUES(CashFlow_Year),
            EstimatedLoanCapacity=VALUES(EstimatedLoanCapacity),
            UsersPerMonth=VALUES(UsersPerMonth),
            Pro_Users_12=VALUES(Pro_Users_12),
            Family_Users_4=VALUES(Family_Users_4),
            Pro_Users_75=VALUES(Pro_Users_75),
            Family_Users_5=VALUES(Family_Users_5)
    ";
    $db->query($sql);
}

/**
 * @var array $daily_metrics Daily app metrics from the database.
 */
$daily_metrics = [];
$result = $db->query("SELECT * FROM daily_app_metrics ORDER BY date ASC");
while ($row = $db->fetch_assoc($result)) {
    $row['day1_retention'] = is_null($row['day1_retention']) ? null : rtrim(rtrim(number_format($row['day1_retention'], 2), '0'), '.') . '%';
    $row['day30_retention'] = is_null($row['day30_retention']) ? null : rtrim(rtrim(number_format($row['day30_retention'], 2), '0'), '.') . '%';
    $row['referral_rate'] = is_null($row['referral_rate']) ? null : rtrim(rtrim(number_format($row['referral_rate'], 2), '0'), '.') . '%';
    $row['rating'] = is_null($row['rating']) ? null : (float)$row['rating'];
    $daily_metrics[] = $row;
}

/**
 * @var array $metrics_config Metrics configuration (targets, thresholds, etc.).
 */
$metrics_config = [];
$result = $db->query("SELECT * FROM metrics_config ORDER BY id ASC");
while ($row = $db->fetch_assoc($result)) {
    if ($row['format'] === 'percentage') {
        $row['target'] = rtrim(rtrim(number_format($row['target'], 2), '0'), '.') . '%';
        $row['threshold_good'] = rtrim(rtrim(number_format($row['threshold_good'], 2), '0'), '.') . '%';
        $row['threshold_warning'] = rtrim(rtrim(number_format($row['threshold_warning'], 2), '0'), '.') . '%';
    }
    $metrics_config[] = $row;
}

$db->close();

/**
 * Output the API response as JSON.
 */
echo json_encode([
    'model_used' => $modelType,
    'forecast' => $forecast,
    'daily_app_metrics' => $daily_metrics,
    'metrics_config' => $metrics_config
], JSON_PRETTY_PRINT);
