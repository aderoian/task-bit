<?php

declare(strict_types=1);

namespace TaskBit;

final class View
{
    /**
     * @param array<string, mixed> $vars
     */
    public static function render(string $name, array $vars = []): string
    {
        $file = dirname(__DIR__) . '/views/' . $name . '.php';
        if (!is_file($file)) {
            throw new \RuntimeException('View not found: ' . $name);
        }
        extract($vars, EXTR_SKIP);
        ob_start();
        require $file;
        return (string) ob_get_clean();
    }

    /**
     * @param array<string, mixed> $vars
     */
    public static function output(string $name, array $vars = []): void
    {
        echo self::render($name, $vars);
    }
}
