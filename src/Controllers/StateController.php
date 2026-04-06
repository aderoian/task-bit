<?php

declare(strict_types=1);

namespace TaskBit\Controllers;

use TaskBit\Http\JsonResponse;
use TaskBit\Services\StateService;

final class StateController extends Controller
{
    public function get(array $params): void
    {
        $uid = $this->requireAuth();
        JsonResponse::send(200, StateService::forUser($uid));
    }
}
