<?php

declare(strict_types=1);

namespace TaskBit\Http;

final class Request
{
    public static function jsonBody(): array
    {
        $raw = file_get_contents('php://input') ?: '';
        if (trim($raw) === '') {
            return [];
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            throw new \InvalidArgumentException('Invalid JSON body');
        }
        return $data;
    }
}
