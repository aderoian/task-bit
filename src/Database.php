<?php

declare(strict_types=1);

namespace TaskBit;

use PDO;
use PDOException;

final class Database
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo !== null) {
            return self::$pdo;
        }
        $path = Config::dbPath();
        $dir = dirname($path);
        if (!is_dir($dir)) {
            if (!@mkdir($dir, 0775, true) && !is_dir($dir)) {
                throw new \RuntimeException('Cannot create database directory: ' . $dir);
            }
        }
        $dsn = 'sqlite:' . $path;
        self::$pdo = new PDO($dsn, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        self::$pdo->exec('PRAGMA foreign_keys = ON;');
        self::migrate(self::$pdo);
        return self::$pdo;
    }

    private static function migrate(PDO $pdo): void
    {
        $schemaFile = dirname(__DIR__) . '/database/schema.sql';
        if (!is_file($schemaFile)) {
            throw new \RuntimeException('Schema file missing: ' . $schemaFile);
        }
        $sql = file_get_contents($schemaFile);
        if ($sql === false) {
            throw new \RuntimeException('Cannot read schema file');
        }
        try {
            $pdo->exec($sql);
        } catch (PDOException $e) {
            throw new \RuntimeException('Migration failed: ' . $e->getMessage(), 0, $e);
        }
    }
}
