<?php

declare(strict_types=1);

namespace TaskBit;

final class Config
{
    public static function dbPath(): string
    {
        $path = getenv('TASKBIT_DB_PATH');
        if ($path !== false && $path !== '') {
            return $path;
        }
        return dirname(__DIR__) . '/database/app.sqlite';
    }

    public static function baseUrl(): string
    {
        $u = getenv('TASKBIT_BASE_URL');
        if ($u !== false && $u !== '') {
            return rtrim($u, '/');
        }
        return '';
    }
}
