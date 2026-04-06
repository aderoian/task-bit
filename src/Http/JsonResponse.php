<?php

declare(strict_types=1);

namespace TaskBit\Http;

final class JsonResponse
{
    public static function send(int $status, array $data): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
}
