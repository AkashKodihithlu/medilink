// ── MediPredict Shared Data Store ──
// All pages import this. Everything persists in localStorage.

const Store = (() => {

  // ── Keys ──
  const KEYS = { patients: 'mp_patients', doctors: 'mp_doctors', allocations: 'mp_allocations', idCounters: 'mp_counters' };

  // ── ID Counters ──
  function getCounters() {
    return JSON.parse(localStorage.getItem(KEYS.idCounters) || '{"patient":1,"doctor":1,"allocation":1}');
  }
  function nextId(type) {
    const c = getCounters();
    const n = c[type];
    c[type]++;
    localStorage.setItem(KEYS.idCounters, JSON.stringify(c));
    return n;
  }

  // ── Generic read/write ──
  function read(key)       { return JSON.parse(localStorage.getItem(key) || '[]'); }
  function write(key, arr) { localStorage.setItem(key, JSON.stringify(arr)); }

  // ══════════════════════════════════
  //  PATIENTS
  // ══════════════════════════════════
  function getPatients()   { return read(KEYS.patients); }

  function addPatient(data) {
    const all = getPatients();
    const p = {
      id:        'PT' + String(nextId('patient')).padStart(3, '0'),
      name:      data.name,
      age:       parseInt(data.age),
      location:  data.location,
      condition: data.condition,
      urgency:   data.urgency,
      consult:   data.consult,
      spec:      data.spec,
      contact:   data.contact || '',
      status:    'Pending',
      createdAt: new Date().toISOString(),
    };
    all.unshift(p);
    write(KEYS.patients, all);
    return p;
  }

  function updatePatientStatus(id, status) {
    const all = getPatients();
    const idx = all.findIndex(p => p.id === id);
    if (idx !== -1) { all[idx].status = status; write(KEYS.patients, all); }
  }

  function deletePatient(id) {
    write(KEYS.patients, getPatients().filter(p => p.id !== id));
  }

  // ══════════════════════════════════
  //  DOCTORS
  // ══════════════════════════════════
  function getDoctors()   { return read(KEYS.doctors); }

  function addDoctor(data) {
    const all = getDoctors();
    const name = data.name.startsWith('Dr.') ? data.name : 'Dr. ' + data.name;
    const d = {
      id:      'DR' + String(nextId('doctor')).padStart(3, '0'),
      name,
      spec:    data.spec,
      loc:     data.loc,
      exp:     data.exp ? data.exp + ' yrs' : 'N/A',
      tele:    data.tele === true || data.tele === 'yes',
      status:  data.status || 'Available',
      emoji:   data.gender === 'female' ? '👩‍⚕️' : '👨‍⚕️',
      contact: data.contact || '',
      createdAt: new Date().toISOString(),
    };
    all.unshift(d);
    write(KEYS.doctors, all);
    return d;
  }

  function updateDoctorStatus(id, status) {
    const all = getDoctors();
    const idx = all.findIndex(d => d.id === id);
    if (idx !== -1) { all[idx].status = status; write(KEYS.doctors, all); }
  }

  function deleteDoctor(id) {
    write(KEYS.doctors, getDoctors().filter(d => d.id !== id));
  }

  // ══════════════════════════════════
  //  ALLOCATIONS
  // ══════════════════════════════════
  function getAllocations() { return read(KEYS.allocations); }

  function addAllocation(data) {
    const all = getAllocations();
    const a = {
      id:          'AL' + String(nextId('allocation')).padStart(3, '0'),
      patientId:   data.patientId,
      patientName: data.patientName,
      doctorId:    data.doctorId,
      doctorName:  data.doctorName,
      doctorSpec:  data.doctorSpec,
      transport:   data.transport,
      urgency:     data.urgency,
      location:    data.location,
      consult:     data.consult,
      confirmedAt: new Date().toISOString(),
    };
    all.unshift(a);
    write(KEYS.allocations, all);
    // Mark doctor busy, patient allocated
    updateDoctorStatus(data.doctorId, 'Busy');
    updatePatientStatus(data.patientId, 'Allocated');
    return a;
  }

  // ══════════════════════════════════
  //  STATS (computed)
  // ══════════════════════════════════
  function getStats() {
    const patients    = getPatients();
    const doctors     = getDoctors();
    const allocations = getAllocations();

    const availableDoctors = doctors.filter(d => d.status === 'Available').length;
    const criticalPatients = patients.filter(p => p.urgency === 'Critical' && p.status !== 'Allocated').length;
    const pendingPatients  = patients.filter(p => p.status === 'Pending').length;
    const teleEnabled      = doctors.filter(d => d.tele).length;

    return {
      totalPatients:    patients.length,
      totalDoctors:     doctors.length,
      availableDoctors,
      criticalPatients,
      totalAllocations: allocations.length,
      pendingPatients,
      teleEnabled,
      recentAllocations: allocations.slice(0, 5),
    };
  }

  // ══════════════════════════════════
  //  COVERAGE GAP (computed)
  // ══════════════════════════════════
  function getCoverageGaps() {
    const patients = getPatients();
    const doctors  = getDoctors();

    // Collect all unique locations from both
    const locationMap = {};

    patients.forEach(p => {
      const loc = p.location.trim();
      if (!locationMap[loc]) locationMap[loc] = { patients: 0, doctors: 0, specs: new Set(), neededSpecs: new Set() };
      locationMap[loc].patients++;
      locationMap[loc].neededSpecs.add(p.spec);
    });

    doctors.forEach(d => {
      const loc = d.loc.trim();
      if (!locationMap[loc]) locationMap[loc] = { patients: 0, doctors: 0, specs: new Set(), neededSpecs: new Set() };
      locationMap[loc].doctors++;
      locationMap[loc].specs.add(d.spec);
    });

    return Object.entries(locationMap).map(([loc, data]) => {
      const ratio = data.patients === 0 ? 1 : data.doctors / data.patients;
      let severity, coverage;
      if (data.doctors === 0 && data.patients > 0)  { severity = 'Critical'; coverage = 0; }
      else if (ratio < 0.3)                          { severity = 'Critical'; coverage = Math.round(ratio * 100); }
      else if (ratio < 0.6)                          { severity = 'Moderate'; coverage = Math.round(ratio * 100); }
      else if (ratio < 1)                            { severity = 'Low';      coverage = Math.round(ratio * 100); }
      else                                           { severity = 'Good';    coverage = 100; }

      const missingSpecs = [...data.neededSpecs].filter(s => !data.specs.has(s));

      return { loc, patients: data.patients, doctors: data.doctors, severity, coverage, missingSpecs };
    }).sort((a, b) => a.coverage - b.coverage);
  }

  // ══════════════════════════════════
  //  CLEAR ALL (dev utility)
  // ══════════════════════════════════
  function clearAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  }

  return { getPatients, addPatient, deletePatient, updatePatientStatus,
           getDoctors, addDoctor, deleteDoctor, updateDoctorStatus,
           getAllocations, addAllocation,
           getStats, getCoverageGaps, clearAll };
})();
