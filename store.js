// ── MediPredict Shared Data Store ──
// All pages import this. Everything persists in localStorage.

const Store = (() => {

  // ── Keys ──
  const KEYS = { patients: 'mp_patients', doctors: 'mp_doctors', allocations: 'mp_allocations', idCounters: 'mp_counters', equipment: 'mp_equipment', slots: 'mp_slots' };

  // ── ID Counters ──
  function getCounters() {
    return JSON.parse(localStorage.getItem(KEYS.idCounters) || '{"patient":1,"doctor":1,"allocation":1,"equipment":1,"slot":1}');
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
  //  EQUIPMENT
  // ══════════════════════════════════
  function getEquipment() { return read(KEYS.equipment); }

  function addEquipment(data) {
    const all = getEquipment();
    const e = {
      id:               'EQ-' + String(nextId('equipment')).padStart(3, '0'),
      name:             data.name,
      category:         data.category,
      facilityName:     data.facilityName,
      facilityLocation: data.facilityLocation,
      serialNumber:     data.serialNumber || '',
      status:           data.status || 'Available',
      purchaseDate:     data.purchaseDate || '',
      createdAt:        new Date().toISOString(),
      updatedAt:        new Date().toISOString(),
    };
    all.unshift(e);
    write(KEYS.equipment, all);
    return e;
  }

  function updateEquipmentStatus(id, status) {
    const all = getEquipment();
    const idx = all.findIndex(e => e.id === id);
    if (idx !== -1) {
      all[idx].status = status;
      all[idx].updatedAt = new Date().toISOString();
      write(KEYS.equipment, all);
    }
  }

  function updateEquipmentFacility(id, facilityName, facilityLocation) {
    const all = getEquipment();
    const idx = all.findIndex(e => e.id === id);
    if (idx !== -1) {
      all[idx].facilityName = facilityName;
      all[idx].facilityLocation = facilityLocation;
      all[idx].updatedAt = new Date().toISOString();
      write(KEYS.equipment, all);
    }
  }

  function deleteEquipment(id) {
    write(KEYS.equipment, getEquipment().filter(e => e.id !== id));
  }

  // ══════════════════════════════════
  //  SLOTS (TELEMEDICINE)
  // ══════════════════════════════════
  function getSlots() { return read(KEYS.slots); }

  function addSlot(data) {
    const all = getSlots();
    const s = {
      id:              'SL-' + String(nextId('slot')).padStart(3, '0'),
      doctorId:        data.doctorId,
      doctorName:      data.doctorName,
      doctorSpec:      data.doctorSpec,
      doctorEmoji:     data.doctorEmoji,
      date:            data.date,
      time:            data.time,
      maxPatients:     data.maxPatients || 1,
      notes:           data.notes || '',
      patientId:       null,
      patientName:     null,
      patientLocation: null,
      status:          'Available',
      createdAt:       new Date().toISOString(),
    };
    all.unshift(s);
    write(KEYS.slots, all);
    return s;
  }

  function bookSlot(slotId, patientId, patientName, patientLocation) {
    const all = getSlots();
    const idx = all.findIndex(s => s.id === slotId);
    if (idx !== -1) {
      all[idx].status = 'Booked';
      all[idx].patientId = patientId;
      all[idx].patientName = patientName;
      all[idx].patientLocation = patientLocation;
      write(KEYS.slots, all);
      updatePatientStatus(patientId, 'Allocated');
    }
  }

  function unbookSlot(slotId) {
    const all = getSlots();
    const idx = all.findIndex(s => s.id === slotId);
    if (idx !== -1) {
      all[idx].status = 'Available';
      all[idx].patientId = null;
      all[idx].patientName = null;
      all[idx].patientLocation = null;
      write(KEYS.slots, all);
    }
  }

  function deleteSlot(id) {
    write(KEYS.slots, getSlots().filter(s => s.id !== id));
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
           getEquipment, addEquipment, updateEquipmentStatus, updateEquipmentFacility, deleteEquipment,
           getSlots, addSlot, bookSlot, unbookSlot, deleteSlot,
           getStats, getCoverageGaps, clearAll };
})();
