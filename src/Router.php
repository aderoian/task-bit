<?php

declare(strict_types=1);

namespace TaskBit;

final class Router
{
    /** @var list<array{method:string,pattern:string,handler:array{0:class-string,1:string}}> */
    private array $routes = [];

    /**
     * @param class-string $class
     */
    public function add(string $method, string $pattern, string $class, string $action): void
    {
        $this->routes[] = ['method' => strtoupper($method), 'pattern' => $pattern, 'handler' => [$class, $action]];
    }

    public function dispatch(string $method, string $path): void
    {
        $method = strtoupper($method);
        $path = '/' . trim($path, '/');
        if ($path === '//') {
            $path = '/';
        }

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }
            $regex = '#^' . preg_replace('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', '(?P<$1>[^/]+)', $route['pattern']) . '$#';
            if (preg_match($regex, $path, $m)) {
                $params = array_filter($m, fn ($k) => !is_int($k), ARRAY_FILTER_USE_KEY);
                /** @var class-string $class */
                $class = $route['handler'][0];
                $action = $route['handler'][1];
                $ctrl = new $class();
                $ctrl->{$action}($params);
                return;
            }
        }

        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Not found']);
    }
}
