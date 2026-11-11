/**
 * src/api/client.js
 *
 * Base fetch wrapper. Attaches the JWT from localStorage automatically.
 * Throws an Error with the server's error message on non-2xx responses.
 */
// In dev, Vite proxies /auth, /users, etc. directly to localhost:3000.
// In production, set VITE_API_URL to the deployed backend URL.
const BASE_URL = import.meta.env.VITE_API_URL || ''

async function request(method, path, body) {
    const token = localStorage.getItem('token')

    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    // 204 No Content — return null
    if (res.status === 204) return null

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
}

export const api = {
    get:    (path)        => request('GET',    path),
    post:   (path, body)  => request('POST',   path, body),
    patch:  (path, body)  => request('PATCH',  path, body),
    delete: (path)        => request('DELETE', path),
}
