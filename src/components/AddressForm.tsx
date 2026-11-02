import { useState, type FormEvent } from 'react'

interface AddressFormProps {
  onSubmit: (address: string) => void
  loading: boolean
}

function AddressForm({ onSubmit, loading }: AddressFormProps) {
  const [address, setAddress] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!address.trim() || loading) return
    onSubmit(address.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="address-form">
      <label htmlFor="address-input">Indirizzo del sito</label>
      <input
        id="address-input"
        name="address"
        type="text"
        placeholder="esempio.it"
        autoComplete="off"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        disabled={loading}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Controllo in corso…' : 'Controlla'}
      </button>
      <p role="status" className="visually-hidden">
        {loading ? 'Controllo in corso, attendi…' : ''}
      </p>
    </form>
  )
}

export default AddressForm
