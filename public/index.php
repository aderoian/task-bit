<?php

declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';

use TaskBit\Controllers\AppController;
use TaskBit\Controllers\AuthController;
use TaskBit\Controllers\ItemController;
use TaskBit\Controllers\ListController;
use TaskBit\Controllers\MergeController;
use TaskBit\Controllers\NotebookController;
use TaskBit\Controllers\ReorderController;
use TaskBit\Controllers\StateController;
use TaskBit\Router;

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?: '/';
$path = rawurldecode($path);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$router = new Router();
$router->add('GET', '/', AppController::class, 'index');
$router->add('GET', '/login', AuthController::class, 'showLogin');
$router->add('POST', '/login', AuthController::class, 'login');
$router->add('GET', '/register', AuthController::class, 'showRegister');
$router->add('POST', '/register', AuthController::class, 'register');
$router->add('POST', '/logout', AuthController::class, 'logout');

$router->add('GET', '/api/state', StateController::class, 'get');
$router->add('POST', '/api/merge', MergeController::class, 'merge');

$router->add('POST', '/api/notebooks', NotebookController::class, 'create');
$router->add('PATCH', '/api/notebooks/{id}', NotebookController::class, 'update');
$router->add('DELETE', '/api/notebooks/{id}', NotebookController::class, 'delete');

$router->add('POST', '/api/notebooks/{notebookId}/lists', ListController::class, 'create');
$router->add('PATCH', '/api/lists/{id}', ListController::class, 'update');
$router->add('DELETE', '/api/lists/{id}', ListController::class, 'delete');

$router->add('POST', '/api/lists/{listId}/items', ItemController::class, 'create');
$router->add('PATCH', '/api/items/{id}', ItemController::class, 'update');
$router->add('DELETE', '/api/items/{id}', ItemController::class, 'delete');

$router->add('POST', '/api/reorder/notebooks', ReorderController::class, 'notebooks');
$router->add('POST', '/api/reorder/lists', ReorderController::class, 'lists');
$router->add('POST', '/api/reorder/items', ReorderController::class, 'items');

$router->dispatch($method, $path);
