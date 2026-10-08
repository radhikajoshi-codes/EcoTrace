/**
 * EcoTrace Facilities Management Module
 * Displays interactive facility directory, performance metrics,
 * rulesets, and modal profile drawer.
 */

class FacilitiesManager {
  constructor() {
    this.stations = [];
    this.init();
  }

  init() {
    this.bindSearch();
  }

  bindSearch() {
    const searchInput = document.getElementById('facilities-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterFacilities(e.target.value);
      });
    }
  }

  setStations(stations) {
    this.stations = stations || [];
    this.renderTable(this.stations);
  }

  filterFacilities(query = '') {
    const q = query.toLowerCase().trim();
    if (!q) {
      this.renderTable(this.stations);
      return;
    }
    const filtered = this.stations.filter(s => 
      s.name.toLowerCase().includes(q) ||
      s.location.toLowerCase().includes(q) ||
      s.status.toLowerCase().includes(q) ||
      s.ruleset.toLowerCase().includes(q)
    );
    this.renderTable(filtered);
  }

  renderTable(list) {
    const tbody = document.getElementById('facilities-table-body');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:#94A3B8;">No facilities found</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(st => {
      const statusClass = st.status.toLowerCase();
      return `
        <tr>
          <td>
            <div class="facility-title-cell">
              <div style="width:8px; height:8px; border-radius:9999px; background:${st.status === 'CRITICAL' ? '#EF4444' : (st.status === 'ELEVATED' ? '#F59E0B' : '#10B981')};"></div>
              <div>
                <div>${st.name}</div>
                <div style="font-size:0.73rem; color:#94A3B8; font-weight:400;">${st.location}</div>
              </div>
            </div>
          </td>
          <td><span class="status-pill ${statusClass}">${st.status}</span></td>
          <td style="font-weight:600; color:#1E293B;">${st.itemsToday.toLocaleString()}</td>
          <td style="font-weight:600; color:#059669;">${st.recoveryRate}%</td>
          <td style="font-weight:600; color:${st.contaminationRate > 10 ? '#DC2626' : '#D97706'};">${st.contaminationRate}%</td>
          <td style="font-weight:600; color:#B45309;">${st.specialHandlingCount}</td>
          <td style="color:#64748B; font-size:0.78rem;">${st.lastActivity || 'Recent'}</td>
          <td>
            <div style="display:flex; gap:6px;">
              <button onclick="window.app.openSortingStationFor('${st.id}')" class="btn-primary btn-accent" style="height:30px; padding:0 10px; font-size:0.75rem;">
                Launch Station
              </button>
              <button onclick="window.facilitiesManager.openFacilityProfile('${st.id}')" class="btn-secondary-action" style="height:30px; padding:0 10px; font-size:0.75rem;">
                Rules & Details
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async openFacilityProfile(stationId) {
    try {
      const res = await fetch(`/api/stations/${stationId}`);
      const data = await res.json();
      if (!data.success) return;

      const st = data.station;
      const rules = data.rules;

      const modal = document.getElementById('modal-facility-detail');
      if (!modal) return;

      document.getElementById('facility-modal-name').innerText = st.name;
      document.getElementById('facility-modal-location').innerText = st.location;
      document.getElementById('facility-modal-ruleset').innerText = st.ruleset;

      const rulesContainer = document.getElementById('facility-modal-rules-list');
      if (rulesContainer) {
        rulesContainer.innerHTML = rules.map(r => `
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:8px 12px; margin-bottom:6px; font-size:0.78rem;">
            <div style="display:flex; justify-content:space-between; font-weight:600; color:#1E293B;">
              <span>${r.material} (${r.condition})</span>
              <span style="color:#059669;">${r.route}</span>
            </div>
            <div style="color:#64748B; font-size:0.72rem; margin-top:2px;">${r.instructions || ''}</div>
          </div>
        `).join('');
      }

      modal.classList.add('open');
    } catch (err) {
      console.error(err);
    }
  }
}

window.FacilitiesManager = FacilitiesManager;
