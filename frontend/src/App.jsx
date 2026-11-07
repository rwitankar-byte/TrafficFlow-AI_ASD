import { useState, useEffect } from 'react'

function App() {
  const [traffic, setTraffic] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('http://localhost:3000/api/traffic/current')
      .then((res) => res.json())
      .then((data) => {
        setTraffic(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error fetching traffic data:', err)
        setLoading(false)
      })
  }, [])

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Smart Traffic Management</h1>
      <p>Real-time traffic monitoring & control dashboard</p>

      {loading ? (
        <p>Loading traffic data...</p>
      ) : traffic ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
          <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h3>North</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{traffic.north} vehicles</p>
          </div>
          <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h3>South</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{traffic.south} vehicles</p>
          </div>
          <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h3>East</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{traffic.east} vehicles</p>
          </div>
          <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h3>West</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{traffic.west} vehicles</p>
          </div>
        </div>
      ) : (
        <p>Failed to load traffic data. Ensure backend is running.</p>
      )}
    </div>
  )
}

export default App
