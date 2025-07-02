<?php
class Database {
    private $host = 'localhost';
    private $port = 3306;
    private $db_name = 'eggwzegc_arybit';
    private $username = 'eggwzegc_arybit';
    private $password = 'Emjye@2453';
    private $conn;

    public function connect() {
        $this->conn = mysqli_init();

        try {
            $success = mysqli_real_connect(
                $this->conn,
                $this->host,
                $this->username,
                $this->password,
                $this->db_name,
                $this->port
            );

            if (!$success) {
                throw new Exception("Connection failed: " . mysqli_connect_error());
            }

            // Set charset to ensure proper encoding
            mysqli_set_charset($this->conn, 'utf8mb4');

            return $this->conn;

        } catch(Exception $e) {
            throw new Exception("Connection Error: " . $e->getMessage());
        }
    }

    public function query($sql) {
        $result = mysqli_query($this->conn, $sql);
        
        if (!$result) {
            throw new Exception("Query failed: " . mysqli_error($this->conn));
        }
        
        return $result;
    }

    public function fetch_all($result) {
        // Check if mysqlnd driver is installed
        if (function_exists('mysqli_fetch_all')) {
            return mysqli_fetch_all($result, MYSQLI_ASSOC);
        } else {
            $all = array();
            while ($row = mysqli_fetch_assoc($result)) {
                $all[] = $row;
            }
            return $all;
        }
    }

    public function fetch_assoc($result) {
        return mysqli_fetch_assoc($result);
    }

    public function close() {
        if ($this->conn) {
            mysqli_close($this->conn);
        }
    }
}