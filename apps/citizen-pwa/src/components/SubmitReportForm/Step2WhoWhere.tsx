import { useState, useEffect } from 'react'
import { MapPin, Navigation, ArrowLeft } from 'lucide-react'
import { Button } from '../ui/Button'
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'

const FALLBACK_BARANGAYS: { name: string; municipality: string }[] = [
  { name: 'Angas', municipality: 'Basud' },
  { name: 'Bactas', municipality: 'Basud' },
  { name: 'Binatagan', municipality: 'Basud' },
  { name: 'Caayunan', municipality: 'Basud' },
  { name: 'Guinatungan', municipality: 'Basud' },
  { name: 'Hinampacan', municipality: 'Basud' },
  { name: 'Langa', municipality: 'Basud' },
  { name: 'Laniton', municipality: 'Basud' },
  { name: 'Lidong', municipality: 'Basud' },
  { name: 'Mampili', municipality: 'Basud' },
  { name: 'Mandazo', municipality: 'Basud' },
  { name: 'Mangcamagong', municipality: 'Basud' },
  { name: 'Manmuntay', municipality: 'Basud' },
  { name: 'Mantugawe', municipality: 'Basud' },
  { name: 'Matnog', municipality: 'Basud' },
  { name: 'Mocong', municipality: 'Basud' },
  { name: 'Oliva', municipality: 'Basud' },
  { name: 'Pagsangahan', municipality: 'Basud' },
  { name: 'Pinagwarasan', municipality: 'Basud' },
  { name: 'Plaridel', municipality: 'Basud' },
  { name: 'Poblacion 1', municipality: 'Basud' },
  { name: 'Poblacion 2', municipality: 'Basud' },
  { name: 'San Felipe', municipality: 'Basud' },
  { name: 'San Jose', municipality: 'Basud' },
  { name: 'San Pascual', municipality: 'Basud' },
  { name: 'Taba-taba', municipality: 'Basud' },
  { name: 'Tacad', municipality: 'Basud' },
  { name: 'Taisan', municipality: 'Basud' },
  { name: 'Tuaca', municipality: 'Basud' },
  { name: 'Alayao', municipality: 'Capalonga' },
  { name: 'Binawangan', municipality: 'Capalonga' },
  { name: 'Calabaca', municipality: 'Capalonga' },
  { name: 'Camagsaan', municipality: 'Capalonga' },
  { name: 'Catabaguangan', municipality: 'Capalonga' },
  { name: 'Catioan', municipality: 'Capalonga' },
  { name: 'Del Pilar', municipality: 'Capalonga' },
  { name: 'Itok', municipality: 'Capalonga' },
  { name: 'Lucbanan', municipality: 'Capalonga' },
  { name: 'Mabini', municipality: 'Capalonga' },
  { name: 'Mactang', municipality: 'Capalonga' },
  { name: 'Magsaysay', municipality: 'Capalonga' },
  { name: 'Mataque', municipality: 'Capalonga' },
  { name: 'Old Camp', municipality: 'Capalonga' },
  { name: 'Poblacion', municipality: 'Capalonga' },
  { name: 'San Antonio', municipality: 'Capalonga' },
  { name: 'San Isidro', municipality: 'Capalonga' },
  { name: 'San Roque', municipality: 'Capalonga' },
  { name: 'Tanawan', municipality: 'Capalonga' },
  { name: 'Ubang', municipality: 'Capalonga' },
  { name: 'Villa Aurora', municipality: 'Capalonga' },
  { name: 'Villa Belen', municipality: 'Capalonga' },
  { name: 'Alawihao', municipality: 'Daet' },
  { name: 'Awitan', municipality: 'Daet' },
  { name: 'Bagasbas', municipality: 'Daet' },
  { name: 'Barangay I', municipality: 'Daet' },
  { name: 'Barangay II', municipality: 'Daet' },
  { name: 'Barangay III', municipality: 'Daet' },
  { name: 'Barangay IV', municipality: 'Daet' },
  { name: 'Barangay V', municipality: 'Daet' },
  { name: 'Barangay VI', municipality: 'Daet' },
  { name: 'Barangay VII', municipality: 'Daet' },
  { name: 'Barangay VIII', municipality: 'Daet' },
  { name: 'Bibirao', municipality: 'Daet' },
  { name: 'Borabod', municipality: 'Daet' },
  { name: 'Calasgasan', municipality: 'Daet' },
  { name: 'Camambugan', municipality: 'Daet' },
  { name: 'Cobangbang', municipality: 'Daet' },
  { name: 'Dogongan', municipality: 'Daet' },
  { name: 'Gahonon', municipality: 'Daet' },
  { name: 'Gubat', municipality: 'Daet' },
  { name: 'Lag-on', municipality: 'Daet' },
  { name: 'Magang', municipality: 'Daet' },
  { name: 'Mambalite', municipality: 'Daet' },
  { name: 'Mancruz', municipality: 'Daet' },
  { name: 'Pamorangon', municipality: 'Daet' },
  { name: 'San Isidro', municipality: 'Daet' },
  { name: 'Bagong Bayan', municipality: 'Jose Panganiban' },
  { name: 'Calero', municipality: 'Jose Panganiban' },
  { name: 'Dahican', municipality: 'Jose Panganiban' },
  { name: 'Dayhagan', municipality: 'Jose Panganiban' },
  { name: 'Larap', municipality: 'Jose Panganiban' },
  { name: 'Luklukan Norte', municipality: 'Jose Panganiban' },
  { name: 'Luklukan Sur', municipality: 'Jose Panganiban' },
  { name: 'Motherlode', municipality: 'Jose Panganiban' },
  { name: 'Nakalaya', municipality: 'Jose Panganiban' },
  { name: 'North Poblacion', municipality: 'Jose Panganiban' },
  { name: 'Osmeña', municipality: 'Jose Panganiban' },
  { name: 'Pag-asa', municipality: 'Jose Panganiban' },
  { name: 'Parang', municipality: 'Jose Panganiban' },
  { name: 'Plaridel', municipality: 'Jose Panganiban' },
  { name: 'Salvacion', municipality: 'Jose Panganiban' },
  { name: 'San Isidro', municipality: 'Jose Panganiban' },
  { name: 'San Jose', municipality: 'Jose Panganiban' },
  { name: 'San Martin', municipality: 'Jose Panganiban' },
  { name: 'San Pedro', municipality: 'Jose Panganiban' },
  { name: 'San Rafael', municipality: 'Jose Panganiban' },
  { name: 'Santa Cruz', municipality: 'Jose Panganiban' },
  { name: 'Santa Elena', municipality: 'Jose Panganiban' },
  { name: 'Santa Milagrosa', municipality: 'Jose Panganiban' },
  { name: 'Santa Rosa Norte', municipality: 'Jose Panganiban' },
  { name: 'Santa Rosa Sur', municipality: 'Jose Panganiban' },
  { name: 'South Poblacion', municipality: 'Jose Panganiban' },
  { name: 'Tamisan', municipality: 'Jose Panganiban' },
  { name: 'Anahaw', municipality: 'Labo' },
  { name: 'Anameam', municipality: 'Labo' },
  { name: 'Awitan', municipality: 'Labo' },
  { name: 'Baay', municipality: 'Labo' },
  { name: 'Bagacay', municipality: 'Labo' },
  { name: 'Bagong Silang I', municipality: 'Labo' },
  { name: 'Bagong Silang II', municipality: 'Labo' },
  { name: 'Bagong Silang III', municipality: 'Labo' },
  { name: 'Bakiad', municipality: 'Labo' },
  { name: 'Bautista', municipality: 'Labo' },
  { name: 'Bayabas', municipality: 'Labo' },
  { name: 'Bayan-bayan', municipality: 'Labo' },
  { name: 'Benit', municipality: 'Labo' },
  { name: 'Bulhao', municipality: 'Labo' },
  { name: 'Cabatuhan', municipality: 'Labo' },
  { name: 'Cabusay', municipality: 'Labo' },
  { name: 'Calabasa', municipality: 'Labo' },
  { name: 'Canapawan', municipality: 'Labo' },
  { name: 'Daguit', municipality: 'Labo' },
  { name: 'Dalas', municipality: 'Labo' },
  { name: 'Dumagmang', municipality: 'Labo' },
  { name: 'Exciban', municipality: 'Labo' },
  { name: 'Fundado', municipality: 'Labo' },
  { name: 'Guinacutan', municipality: 'Labo' },
  { name: 'Guisican', municipality: 'Labo' },
  { name: 'Gumamela', municipality: 'Labo' },
  { name: 'Iberica', municipality: 'Labo' },
  { name: 'Kalamunding', municipality: 'Labo' },
  { name: 'Lugui', municipality: 'Labo' },
  { name: 'Mabilo I', municipality: 'Labo' },
  { name: 'Mabilo II', municipality: 'Labo' },
  { name: 'Macogon', municipality: 'Labo' },
  { name: 'Mahawan-hawan', municipality: 'Labo' },
  { name: 'Malangcao-Basud', municipality: 'Labo' },
  { name: 'Malasugui', municipality: 'Labo' },
  { name: 'Malatap', municipality: 'Labo' },
  { name: 'Malaya', municipality: 'Labo' },
  { name: 'Malibago', municipality: 'Labo' },
  { name: 'Maot', municipality: 'Labo' },
  { name: 'Masalong', municipality: 'Labo' },
  { name: 'Matanlang', municipality: 'Labo' },
  { name: 'Napaod', municipality: 'Labo' },
  { name: 'Pag-asa', municipality: 'Labo' },
  { name: 'Pangpang', municipality: 'Labo' },
  { name: 'Pinya', municipality: 'Labo' },
  { name: 'San Antonio', municipality: 'Labo' },
  { name: 'San Francisco', municipality: 'Labo' },
  { name: 'Santa Cruz', municipality: 'Labo' },
  { name: 'Submakin', municipality: 'Labo' },
  { name: 'Talobatib', municipality: 'Labo' },
  { name: 'Tigbinan', municipality: 'Labo' },
  { name: 'Tulay na Lupa', municipality: 'Labo' },
  { name: 'Apuao', municipality: 'Mercedes' },
  { name: 'Barangay I', municipality: 'Mercedes' },
  { name: 'Barangay II', municipality: 'Mercedes' },
  { name: 'Barangay III', municipality: 'Mercedes' },
  { name: 'Barangay IV', municipality: 'Mercedes' },
  { name: 'Barangay V', municipality: 'Mercedes' },
  { name: 'Barangay VI', municipality: 'Mercedes' },
  { name: 'Barangay VII', municipality: 'Mercedes' },
  { name: 'Caringo', municipality: 'Mercedes' },
  { name: 'Catandunganon', municipality: 'Mercedes' },
  { name: 'Cayucyucan', municipality: 'Mercedes' },
  { name: 'Colasi', municipality: 'Mercedes' },
  { name: 'Del Rosario', municipality: 'Mercedes' },
  { name: 'Gaboc', municipality: 'Mercedes' },
  { name: 'Hamoraon', municipality: 'Mercedes' },
  { name: 'Hinipaan', municipality: 'Mercedes' },
  { name: 'Lalawigan', municipality: 'Mercedes' },
  { name: 'Lanot', municipality: 'Mercedes' },
  { name: 'Mambungalon', municipality: 'Mercedes' },
  { name: 'Manguisoc', municipality: 'Mercedes' },
  { name: 'Masalongsalong', municipality: 'Mercedes' },
  { name: 'Matoogtoog', municipality: 'Mercedes' },
  { name: 'Pambuhan', municipality: 'Mercedes' },
  { name: 'Quinapaguian', municipality: 'Mercedes' },
  { name: 'San Roque', municipality: 'Mercedes' },
  { name: 'Tarum', municipality: 'Mercedes' },
  { name: 'Awitan', municipality: 'Paracale' },
  { name: 'Bagumbayan', municipality: 'Paracale' },
  { name: 'Bakal', municipality: 'Paracale' },
  { name: 'Batobalani', municipality: 'Paracale' },
  { name: 'Calaburnay', municipality: 'Paracale' },
  { name: 'Capacuan', municipality: 'Paracale' },
  { name: 'Casalugan', municipality: 'Paracale' },
  { name: 'Dagang', municipality: 'Paracale' },
  { name: 'Dalnac', municipality: 'Paracale' },
  { name: 'Dancalan', municipality: 'Paracale' },
  { name: 'Gumaus', municipality: 'Paracale' },
  { name: 'Labnig', municipality: 'Paracale' },
  { name: 'Macolabo Island', municipality: 'Paracale' },
  { name: 'Malacbang', municipality: 'Paracale' },
  { name: 'Malaguit', municipality: 'Paracale' },
  { name: 'Mampungo', municipality: 'Paracale' },
  { name: 'Mangkasay', municipality: 'Paracale' },
  { name: 'Maybato', municipality: 'Paracale' },
  { name: 'Palanas', municipality: 'Paracale' },
  { name: 'Pinagbirayan Malaki', municipality: 'Paracale' },
  { name: 'Pinagbirayan Munti', municipality: 'Paracale' },
  { name: 'Poblacion Norte', municipality: 'Paracale' },
  { name: 'Poblacion Sur', municipality: 'Paracale' },
  { name: 'Tabas', municipality: 'Paracale' },
  { name: 'Talusan', municipality: 'Paracale' },
  { name: 'Tawig', municipality: 'Paracale' },
  { name: 'Tugos', municipality: 'Paracale' },
  { name: 'Daculang Bolo', municipality: 'San Lorenzo Ruiz' },
  { name: 'Dagotdotan', municipality: 'San Lorenzo Ruiz' },
  { name: 'Langga', municipality: 'San Lorenzo Ruiz' },
  { name: 'Laniton', municipality: 'San Lorenzo Ruiz' },
  { name: 'Maisog', municipality: 'San Lorenzo Ruiz' },
  { name: 'Mampurog', municipality: 'San Lorenzo Ruiz' },
  { name: 'Manlimonsito', municipality: 'San Lorenzo Ruiz' },
  { name: 'Matacong', municipality: 'San Lorenzo Ruiz' },
  { name: 'Salvacion', municipality: 'San Lorenzo Ruiz' },
  { name: 'San Antonio', municipality: 'San Lorenzo Ruiz' },
  { name: 'San Isidro', municipality: 'San Lorenzo Ruiz' },
  { name: 'San Ramon', municipality: 'San Lorenzo Ruiz' },
  { name: 'Asdum', municipality: 'San Vicente' },
  { name: 'Cabanbanan', municipality: 'San Vicente' },
  { name: 'Calabagas', municipality: 'San Vicente' },
  { name: 'Fabrica', municipality: 'San Vicente' },
  { name: 'Iraya Sur', municipality: 'San Vicente' },
  { name: 'Man-ogob', municipality: 'San Vicente' },
  { name: 'Poblacion District I', municipality: 'San Vicente' },
  { name: 'Poblacion District II', municipality: 'San Vicente' },
  { name: 'San Jose', municipality: 'San Vicente' },
  { name: 'Basiad', municipality: 'Santa Elena' },
  { name: 'Bulala', municipality: 'Santa Elena' },
  { name: 'Don Tomas', municipality: 'Santa Elena' },
  { name: 'Guitol', municipality: 'Santa Elena' },
  { name: 'Kabuluan', municipality: 'Santa Elena' },
  { name: 'Kagtalaba', municipality: 'Santa Elena' },
  { name: 'Maulawin', municipality: 'Santa Elena' },
  { name: 'Patag Ibaba', municipality: 'Santa Elena' },
  { name: 'Patag Iraya', municipality: 'Santa Elena' },
  { name: 'Plaridel', municipality: 'Santa Elena' },
  { name: 'Polungguitguit', municipality: 'Santa Elena' },
  { name: 'Rizal', municipality: 'Santa Elena' },
  { name: 'Salvacion', municipality: 'Santa Elena' },
  { name: 'San Lorenzo', municipality: 'Santa Elena' },
  { name: 'San Pedro', municipality: 'Santa Elena' },
  { name: 'San Vicente', municipality: 'Santa Elena' },
  { name: 'Santa Elena', municipality: 'Santa Elena' },
  { name: 'Tabugon', municipality: 'Santa Elena' },
  { name: 'Villa San Isidro', municipality: 'Santa Elena' },
  { name: 'Binanuaan', municipality: 'Talisay' },
  { name: 'Caawigan', municipality: 'Talisay' },
  { name: 'Cahabaan', municipality: 'Talisay' },
  { name: 'Calintaan', municipality: 'Talisay' },
  { name: 'Del Carmen', municipality: 'Talisay' },
  { name: 'Gabon', municipality: 'Talisay' },
  { name: 'Itomang', municipality: 'Talisay' },
  { name: 'Poblacion', municipality: 'Talisay' },
  { name: 'San Francisco', municipality: 'Talisay' },
  { name: 'San Isidro', municipality: 'Talisay' },
  { name: 'San Jose', municipality: 'Talisay' },
  { name: 'San Nicolas', municipality: 'Talisay' },
  { name: 'Santa Cruz', municipality: 'Talisay' },
  { name: 'Santa Elena', municipality: 'Talisay' },
  { name: 'Santo Niño', municipality: 'Talisay' },
  { name: 'Aguit-it', municipality: 'Vinzons' },
  { name: 'Banocboc', municipality: 'Vinzons' },
  { name: 'Barangay I', municipality: 'Vinzons' },
  { name: 'Barangay II', municipality: 'Vinzons' },
  { name: 'Barangay III', municipality: 'Vinzons' },
  { name: 'Cagbalogo', municipality: 'Vinzons' },
  { name: 'Calangcawan Norte', municipality: 'Vinzons' },
  { name: 'Calangcawan Sur', municipality: 'Vinzons' },
  { name: 'Guinacutan', municipality: 'Vinzons' },
  { name: 'Mangcawayan', municipality: 'Vinzons' },
  { name: 'Mangcayo', municipality: 'Vinzons' },
  { name: 'Manlucugan', municipality: 'Vinzons' },
  { name: 'Matango', municipality: 'Vinzons' },
  { name: 'Napilihan', municipality: 'Vinzons' },
  { name: 'Pinagtigasan', municipality: 'Vinzons' },
  { name: 'Sabang', municipality: 'Vinzons' },
  { name: 'Santo Domingo', municipality: 'Vinzons' },
  { name: 'Singi', municipality: 'Vinzons' },
  { name: 'Sula', municipality: 'Vinzons' },
]

const MUNICIPALITY_LABELS = Object.fromEntries(
  CAMARINES_NORTE_MUNICIPALITIES.map((m) => [m.id, m.label]),
)

const MUNI_LABELS_SORTED = [...CAMARINES_NORTE_MUNICIPALITIES]
  .sort((a, b) => a.label.localeCompare(b.label))
  .map((m) => ({ id: m.id, label: m.label }))

interface Step2WhoWhereProps {
  onNext: (data: {
    location: { lat: number; lng: number }
    reporterName: string
    reporterMsisdn: string
    patientCount: number
    locationMethod: 'gps' | 'manual'
    municipalityId?: string
    municipalityLabel?: string
    barangayId?: string
    nearestLandmark?: string
  }) => void
  onBack: () => void
  isSubmitting?: boolean
}

export function Step2WhoWhere({ onNext, onBack, isSubmitting = false }: Step2WhoWhereProps) {
  const [locationMethod, setLocationMethod] = useState<'gps' | 'manual' | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState('')
  const [selectedBarangayId, setSelectedBarangayId] = useState<string | undefined>(undefined)
  const [nearestLandmark, setNearestLandmark] = useState<string>('')
  const [reporterName, setReporterName] = useState('')
  const [reporterMsisdn, setReporterMsisdn] = useState('')
  const [anyoneHurt, setAnyoneHurt] = useState(false)
  const [patientCount, setPatientCount] = useState(0)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [hasMemory, setHasMemory] = useState(false)

  const attemptGps = async () => {
    setLocationError(null)
    setGpsLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!navigator.geolocation) {
        setLocationError('GPS not supported on this device.')
        setLocationMethod('manual')
        return
      }
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      })
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      setLocationMethod('gps')
    } catch (err: unknown) {
      console.error('[Step2WhoWhere] attemptGps failed:', err)
      let msg = 'Could not get location. Choose municipality manually.'
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as GeolocationPositionError).code
        if (code === 1) msg = 'Location access denied. Choose municipality manually.'
        else if (code === 3) msg = 'Location timed out. Choose municipality manually.'
      }
      setLocationError(msg)
      setLocationMethod('manual')
    } finally {
      setGpsLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void attemptGps()
  }, [])

  useEffect(() => {
    try {
      const savedName = localStorage.getItem('bantayog.reporter.name')
      // Phone is session-only to limit long-lived PII exposure
      const savedMsisdn = sessionStorage.getItem('bantayog.reporter.msisdn')
      if (savedName || savedMsisdn) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (savedName) setReporterName(savedName)
        if (savedMsisdn) setReporterMsisdn(savedMsisdn)
        setHasMemory(true)
      }
    } catch {
      // Restricted/private mode — skip pre-fill silently
    }
  }, [])

  const handleSelectMunicipality = (muniId: string) => {
    setSelectedMunicipalityId(muniId)
    setSelectedBarangayId(undefined)
  }

  const handleNext = () => {
    setNameError(null)
    setPhoneError(null)

    if (locationMethod === 'manual' && !selectedMunicipalityId) {
      setLocationError('Please select your municipality.')
      return
    }
    if (!reporterName.trim()) {
      setNameError('Please enter your name.')
      return
    }
    if (!reporterMsisdn.trim()) {
      setPhoneError('Please enter your phone number.')
      return
    }

    let finalLocation = location
    let municipalityLabel: string | undefined
    if (locationMethod === 'manual' && selectedMunicipalityId) {
      const muni = CAMARINES_NORTE_MUNICIPALITIES.find((m) => m.id === selectedMunicipalityId)
      municipalityLabel = muni?.label
      if (muni?.centroid) {
        finalLocation = { lat: muni.centroid.lat, lng: muni.centroid.lng }
      } else {
        finalLocation ??= { lat: 0, lng: 0 }
      }
    }

    try {
      localStorage.setItem('bantayog.reporter.name', reporterName)
      // Phone is session-only to limit long-lived PII exposure
      sessionStorage.setItem('bantayog.reporter.msisdn', reporterMsisdn)
    } catch {
      // Restricted/private mode — skip persist silently
    }

    onNext({
      location: finalLocation ?? { lat: 0, lng: 0 },
      reporterName,
      reporterMsisdn,
      patientCount: anyoneHurt ? patientCount : 0,
      locationMethod: locationMethod ?? 'manual',
      ...(locationMethod === 'manual' && selectedMunicipalityId
        ? {
            municipalityId: selectedMunicipalityId,
            ...(municipalityLabel ? { municipalityLabel } : {}),
            ...(selectedBarangayId ? { barangayId: selectedBarangayId } : {}),
            ...(nearestLandmark ? { nearestLandmark } : {}),
          }
        : {}),
    })
  }

  const canProceed =
    (locationMethod === 'gps' && !!location) ||
    (locationMethod === 'manual' && !!selectedMunicipalityId) ||
    false

  const barangayOptions = selectedMunicipalityId
    ? FALLBACK_BARANGAYS.filter(
        (b) => MUNICIPALITY_LABELS[selectedMunicipalityId] === b.municipality,
      ).sort((a, b) => a.name.localeCompare(b.name))
    : []

  return (
    <div className="page-container">
      <div className="page-header">
        <button type="button" onClick={onBack} aria-label="Go back" className="back-btn">
          <ArrowLeft size={16} />
        </button>
        <span className="step-indicator">2 of 3</span>
      </div>

      <div className="progress-dots">
        <div className="progress-dot progress-dot--active" />
        <div className="progress-dot progress-dot--active" />
        <div className="progress-dot progress-dot--inactive" />
      </div>

      <h2 className="step-title">Where and who?</h2>
      <p className="step-subtitle">All fields below are required</p>

      {locationMethod === null && !gpsLoading ? (
        <div className="location-picker-start">
          <p className="location-picker-prompt">How would you like to provide your location?</p>
          <button
            type="button"
            className="location-picker-btn"
            onClick={() => {
              void attemptGps()
              setGpsLoading(true)
            }}
          >
            <Navigation size={18} />
            <span>Use current location (GPS)</span>
          </button>
          <button
            type="button"
            className="location-picker-btn"
            onClick={() => {
              setLocationMethod('manual')
            }}
          >
            <MapPin size={18} />
            <span>Choose municipality manually</span>
          </button>
        </div>
      ) : null}

      {gpsLoading ? (
        <div className="location-loading">
          <div className="location-loading-spinner" />
          <p className="location-loading-text">Getting your location...</p>
        </div>
      ) : null}

      {locationMethod === 'gps' && location ? (
        <div className="field-group">
          <p className="field-label">Location</p>
          <button
            type="button"
            className="location-btn"
            onClick={() => {
              setLocationMethod(null)
              setLocation(null)
            }}
          >
            <div className="location-icon">
              <Navigation size={14} />
            </div>
            <div className="location-info">
              <div className="location-primary">
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </div>
              <div className="location-secondary">GPS · accuracy varies</div>
            </div>
            <span className="location-change">Change</span>
          </button>
          {locationError && <p className="field-error">{locationError}</p>}
          <div className="map-preview">
            <div className="map-marker" />
          </div>
        </div>
      ) : null}

      {locationMethod === 'manual' ? (
        <div className="field-group">
          <p className="field-label">Municipality</p>
          <select
            className="text-select"
            value={selectedMunicipalityId}
            onChange={(e) => {
              handleSelectMunicipality(e.target.value)
              setLocationError(null)
            }}
          >
            <option value="">Select municipality...</option>
            {MUNI_LABELS_SORTED.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {locationError && <p className="field-error">{locationError}</p>}
        </div>
      ) : null}

      {locationMethod === 'manual' && selectedMunicipalityId ? (
        <div className="field-group">
          <p className="field-label">
            Barangay
            <span className="field-label-optional"> — optional</span>
          </p>
          <select
            className="text-select"
            value={selectedBarangayId}
            onChange={(e) => {
              setSelectedBarangayId(e.target.value)
            }}
          >
            <option value="">Select barangay (optional)...</option>
            {barangayOptions.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {locationMethod === 'manual' && selectedMunicipalityId ? (
        <div className="field-group">
          <p className="field-label">
            Nearest landmark
            <span className="field-label-optional"> — optional</span>
          </p>
          <input
            type="text"
            value={nearestLandmark}
            onChange={(e) => {
              setNearestLandmark(e.target.value)
            }}
            placeholder="e.g. Near the town plaza, across from Mang Juan Store"
            className="text-input"
            maxLength={200}
          />
        </div>
      ) : null}

      {locationMethod !== null ? (
        <>
          {hasMemory && <p className="memory-hint">Pre-filled from your last report</p>}
          <div className="field-group">
            <p className="field-label">Your name</p>
            <input
              type="text"
              value={reporterName}
              onChange={(e) => {
                setReporterName(e.target.value)
                setNameError(null)
              }}
              placeholder="Maria Dela Cruz"
              className="text-input"
              required
            />
            {nameError && <p className="field-error">{nameError}</p>}
          </div>

          <div className="field-group">
            <p className="field-label">Phone number</p>
            <input
              type="tel"
              value={reporterMsisdn}
              onChange={(e) => {
                setReporterMsisdn(e.target.value)
                setPhoneError(null)
              }}
              placeholder="+63 912 345 6789"
              className="text-input"
              required
            />
            {phoneError && <p className="field-error">{phoneError}</p>}
            <p className="phone-hint">
              <strong>Gives you faster help.</strong> Admins call this number if they need more
              details. <em>Mas mabilis kang matutulungan.</em>
            </p>
          </div>

          <div className="field-group field-group--urgent">
            <p className="field-label">
              Is anyone hurt?
              <em className="field-label-optional"> May injured ba?</em>
            </p>
            <div className="toggle-group">
              <button
                type="button"
                onClick={() => {
                  setAnyoneHurt(true)
                }}
                className={`toggle-btn${anyoneHurt ? ' toggle-btn--selected' : ''}`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => {
                  setAnyoneHurt(false)
                }}
                className={`toggle-btn${!anyoneHurt ? ' toggle-btn--selected' : ''}`}
              >
                No
              </button>
            </div>

            {anyoneHurt && (
              <div className="patient-advisory">
                <p className="patient-advisory-label">How many patients?</p>
                <div className="patient-counter">
                  <button
                    type="button"
                    onClick={() => {
                      setPatientCount(Math.max(0, patientCount - 1))
                    }}
                    className="counter-btn"
                    disabled={patientCount === 0}
                  >
                    −
                  </button>
                  <div className="counter-display">{patientCount}</div>
                  <button
                    type="button"
                    onClick={() => {
                      setPatientCount(patientCount + 1)
                    }}
                    className="counter-increment-btn"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          <Button
            variant="primary"
            fullWidth
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
            style={{ marginTop: '1.5rem' }}
          >
            {isSubmitting ? 'Please wait...' : 'Continue'}
          </Button>
        </>
      ) : null}
    </div>
  )
}
