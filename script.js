document.addEventListener("DOMContentLoaded", async () => {

  /* =========================================================
     DIVI64 MAINFRAME V3
     JS // SUPABASE CENTRAL SYSTEM
  ========================================================== */

  const SUPABASE_URL = "https://goobvrxgrbrxfqfjudpa.supabase.co";
  const SUPABASE_KEY = "sb_publishable_rpPXtQW9SiO-n0Smzg1ASw_QhxKNbdc";

  const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  const CLEARANCE_NAMES = {
    0: "UNAUTHORIZED",
    1: "RESTRICTED",
    2: "CONFIDENTIAL",
    3: "SECRET",
    4: "TOP SECRET",
    5: "OVERWATCH"
  };

  const ADMIN_LEVELS = {
    "D-64-ADM-01": "PRIMARY ADMIN",
    "D-64-ADM-02": "SECONDARY ADMIN"
  };

  let currentUser = null;
  let currentPersonnel = null;
  let currentPage = "dashboard";
  let currentPersonnelTarget = null;
  let currentOperationTab = "active";
  let currentSecurityTab = "sessions";
  let pendingConfirmation = null;

  let state = {
    personnel: {},
    blacklist: [],
    blacklistRequests: [],
    sessions: [],
    operations: [],
    files: [],
    audit: [],
    securityEvents: [],
    notifications: [],
    system: {
      maintenance: false,
      emergency: false,
      databaseStatus: "ONLINE",
      authenticationStatus: "ONLINE",
      auditStatus: "ONLINE",
      blacklistStatus: "ONLINE",
      archiveStatus: "ONLINE",
      storage: 37
    }
  };


  /* =========================================================
     UTILITIES
  ========================================================== */

  function now() {
    return new Date().toISOString();
  }

  function formattedDate(date) {
    if (!date) return "NEVER";

    return new Date(date).toLocaleString("en-GB", {
      dateStyle: "short",
      timeStyle: "medium"
    });
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getClearance() {
    return currentPersonnel
      ? Number(currentPersonnel.clearance || 0)
      : 0;
  }

  function hasClearance(required) {
    return getClearance() >= required;
  }

  function isAdmin() {
    return !!(
      currentUser &&
      ADMIN_LEVELS[currentUser]
    );
  }

  function isPrimaryAdmin() {
    return currentUser === "D-64-ADM-01";
  }


  /* =========================================================
     DATABASE LOADING
  ========================================================== */

  async function loadDatabase() {

    try {

      const [
        personnelResult,
        operationsResult,
        filesResult,
        blacklistResult,
        blacklistRequestsResult,
        sessionsResult,
        auditResult,
        securityResult,
        notificationsResult,
        configurationResult
      ] = await Promise.all([

        supabaseClient
          .from("personnel")
          .select("*")
          .order("id"),

        supabaseClient
          .from("operations")
          .select("*")
          .order("id"),

        supabaseClient
          .from("classified_files")
          .select("*")
          .order("clearance"),

        supabaseClient
          .from("blacklist_entries")
          .select("*")
          .order("created_at", {
            ascending: false
          }),

        supabaseClient
          .from("blacklist_requests")
          .select("*")
          .order("created_at", {
            ascending: false
          }),

        supabaseClient
          .from("personnel_sessions")
          .select("*")
          .order("login_time", {
            ascending: false
          }),

        supabaseClient
          .from("audit_log")
          .select("*")
          .order("timestamp", {
            ascending: false
          })
          .limit(500),

        supabaseClient
          .from("security_events")
          .select("*")
          .order("timestamp", {
            ascending: false
          })
          .limit(500),

        supabaseClient
          .from("notifications")
          .select("*")
          .order("created_at", {
            ascending: false
          })
          .limit(50),

        supabaseClient
          .from("system_configuration")
          .select("*")
      ]);


      const results = [
        personnelResult,
        operationsResult,
        filesResult,
        blacklistResult,
        blacklistRequestsResult,
        sessionsResult,
        auditResult,
        securityResult,
        notificationsResult,
        configurationResult
      ];

      const failed = results.find(result => result.error);

      if (failed) {
        console.error("DIVI64 DATABASE ERROR:", failed.error);
        showAlert("DATABASE SYNCHRONIZATION ERROR");
        return false;
      }


      state.personnel = {};

      (personnelResult.data || []).forEach(person => {
        state.personnel[person.id] = person;
      });

      state.operations = operationsResult.data || [];
      state.files = filesResult.data || [];
      state.blacklist = blacklistResult.data || [];
      state.blacklistRequests = blacklistRequestsResult.data || [];
      state.sessions = sessionsResult.data || [];
      state.audit = auditResult.data || [];
      state.securityEvents = securityResult.data || [];
      state.notifications = notificationsResult.data || [];


      const configuration =
        configurationResult.data || [];

      configuration.forEach(item => {

        const key =
          item.key ||
          item.config_key ||
          item.name;

        const value =
          item.value ??
          item.config_value;

        if (key) {
          state.system[key] = value;
        }
      });


      return true;

    } catch (error) {

      console.error(error);
      showAlert("DATABASE CONNECTION FAILURE");

      return false;
    }
  }


  /* =========================================================
     AUDIT
  ========================================================== */

  async function audit(
    action,
    target = "-",
    details = "",
    status = "COMPLETED"
  ) {

    if (!currentPersonnel?.id) return;

    const { error } =
      await supabaseClient
        .from("audit_log")
        .insert({
          user_id: currentPersonnel.id,
          action,
          target,
          details,
          status
        });

    if (error) {
      console.error("AUDIT ERROR:", error);
    }
  }


  /* =========================================================
     SECURITY EVENTS
  ========================================================== */

  async function securityEvent(
    type,
    target = "-",
    details = ""
  ) {

    const userId =
      currentPersonnel?.id || null;

    const { error } =
      await supabaseClient
        .from("security_events")
        .insert({
          user_id: userId,
          type,
          target,
          details
        });

    if (error) {
      console.error("SECURITY EVENT ERROR:", error);
    }
  }


  /* =========================================================
     NOTIFICATIONS
  ========================================================== */

  async function addNotification(title, text) {

    const { error } =
      await supabaseClient
        .from("notifications")
        .insert({
          title,
          text
        });

    if (error) {
      console.error("NOTIFICATION ERROR:", error);
    }
  }


  /* =========================================================
     LOGIN
  ========================================================== */

  const loginForm =
    document.getElementById("loginForm");

  loginForm.addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      const id =
        document.getElementById("loginUser")
          .value
          .trim()
          .toUpperCase();

      const password =
        document.getElementById("loginPassword")
          .value;

      const status =
        document.getElementById("loginStatus");


      if (!id || !password) {

        status.textContent =
          "IDENTIFICATION AND PASSWORD REQUIRED.";

        return;
      }


      status.textContent =
        "AUTHENTICATING...";


      const { data, error } =
        await supabaseClient.auth.signInWithPassword({
          email: `${id}@divi64.local`,
          password
        });


      if (error) {

        console.error(error);

        status.textContent =
          "INVALID AUTHORIZATION CREDENTIALS.";

        await securityEvent(
          "LOGIN_FAILURE",
          id,
          "Authentication rejected."
        );

        return;
      }


      if (!data.user) {

        status.textContent =
          "AUTHENTICATION FAILURE.";

        return;
      }


      const { data: personnel, error: personnelError } =
        await supabaseClient
          .from("personnel")
          .select("*")
          .eq("auth_user_id", data.user.id)
          .single();


      if (personnelError || !personnel) {

        await supabaseClient.auth.signOut();

        status.textContent =
          "PERSONNEL AUTHORIZATION RECORD NOT FOUND.";

        return;
      }


      if (personnel.status !== "ACTIVE") {

        await supabaseClient.auth.signOut();

        status.textContent =
          `ACCOUNT ${personnel.status}.`;

        return;
      }


      currentUser = personnel.id;
      currentPersonnel = personnel;


      await supabaseClient
        .from("personnel")
        .update({
          last_access: now()
        })
        .eq("id", personnel.id);


      const sessionId =
        crypto.randomUUID();


      await supabaseClient
        .from("personnel_sessions")
        .insert({
          id: sessionId,
          personnel_id: personnel.id,
          login_time: now(),
          active: true
        });


      await audit(
        "LOGIN",
        personnel.id,
        "Successful authentication."
      );

      await securityEvent(
        "LOGIN_SUCCESS",
        personnel.id,
        "Successful authentication."
      );


      await loadDatabase();


      document.getElementById("loginScreen")
        .classList.add("hidden");

      document.getElementById("mainSystem")
        .classList.remove("hidden");


      updateHeader();
      renderAll();


      showAlert(
        `AUTHENTICATION ACCEPTED. WELCOME ${personnel.id}.`
      );
    }
  );


  /* =========================================================
     LOGOUT
  ========================================================== */

  document.getElementById("logoutButton")
    .addEventListener(
      "click",
      async () => {

        if (!currentPersonnel) return;


        await supabaseClient
          .from("personnel_sessions")
          .update({
            active: false,
            logout_time: now()
          })
          .eq("personnel_id", currentPersonnel.id)
          .eq("active", true);


        await audit(
          "LOGOUT",
          currentPersonnel.id,
          "User session terminated."
        );


        await supabaseClient.auth.signOut();


        currentUser = null;
        currentPersonnel = null;


        document.getElementById("mainSystem")
          .classList.add("hidden");

        document.getElementById("loginScreen")
          .classList.remove("hidden");

        document.getElementById("loginForm")
          .reset();

        document.getElementById("loginStatus")
          .textContent = "";
      }
    );


  /* =========================================================
     HEADER
  ========================================================== */

  function updateHeader() {

    if (!currentPersonnel) return;

    document.getElementById("headerUser")
      .textContent = currentPersonnel.id;

    document.getElementById("headerClearance")
      .textContent =
        `CL ${currentPersonnel.clearance} // ${
          CLEARANCE_NAMES[currentPersonnel.clearance]
        }`;

    document.getElementById("dashboardClearance")
      .textContent =
        currentPersonnel.clearance;

    document.getElementById("dashboardWelcome")
      .textContent =
        `WELCOME ${currentPersonnel.id} // ${
          currentPersonnel.type
        }`;
  }


  /* =========================================================
     NAVIGATION
  ========================================================== */

  document.querySelectorAll(".nav-item")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => navigate(button.dataset.page)
      );

    });


  function navigate(page) {

    const required = {
      dashboard: 0,
      personnel: 1,
      archives: 1,
      operations: 2,
      security: 2,
      blacklist: 4,
      administration: 4
    };


    if (
      required[page] === undefined ||
      !hasClearance(required[page])
    ) {

      showAlert(
        `ACCESS DENIED // CLEARANCE ${
          required[page] ?? 0
        } REQUIRED`
      );

      securityEvent(
        "ACCESS_DENIED",
        page,
        `Required clearance: ${required[page] ?? 0}`
      );

      return;
    }


    currentPage = page;


    document.querySelectorAll(".page")
      .forEach(p =>
        p.classList.add("hidden")
      );


    const target =
      document.getElementById(
        `page${
          page.charAt(0).toUpperCase()
        }${page.slice(1)}`
      );


    if (target) {
      target.classList.remove("hidden");
    }


    document.querySelectorAll(".nav-item")
      .forEach(button => {

        button.classList.toggle(
          "active",
          button.dataset.page === page
        );

      });


    renderPage(page);
  }


  function renderPage(page) {

    if (page === "dashboard")
      renderDashboard();

    if (page === "personnel")
      renderPersonnel();

    if (page === "archives")
      renderArchives();

    if (page === "operations")
      renderOperations();

    if (page === "security")
      renderSecurity();

    if (page === "blacklist")
      renderBlacklist();

    if (page === "administration")
      renderAdministration();
  }


  function renderAll() {

    updateHeader();
    renderDashboard();
    renderPersonnel();
    renderArchives();
    renderOperations();
    renderSecurity();
    renderBlacklist();
    renderAdministration();
  }


  /* =========================================================
     DASHBOARD
  ========================================================== */

  function renderDashboard() {

    document.getElementById("statPersonnel")
      .textContent =
        Object.keys(state.personnel).length;


    document.getElementById("statSessions")
      .textContent =
        state.sessions.filter(
          session => session.active
        ).length;


    document.getElementById("statBlacklist")
      .textContent =
        state.blacklist.length;


    document.getElementById("statSecurityEvents")
      .textContent =
        state.securityEvents.length;


    const activity =
      document.getElementById(
        "dashboardActivity"
      );


    const recent =
      state.audit.slice(0, 12);


    activity.innerHTML =
      recent.length

        ? recent.map(entry => `
          <div class="activity-entry">

            <div class="activity-time">
              ${escapeHTML(
                formattedDate(entry.timestamp)
              )}
            </div>

            <div class="activity-text">
              ${escapeHTML(entry.action)}
              // ${escapeHTML(
                entry.user_id || "-"
              )}
              ${
                entry.target !== "-"
                  ? `// ${escapeHTML(entry.target)}`
                  : ""
              }
            </div>

          </div>
        `).join("")

        : `
          <div class="empty-state">
            NO RECENT ACTIVITY
          </div>
        `;


    const notifications =
      document.getElementById(
        "dashboardNotifications"
      );


    notifications.innerHTML =
      state.notifications.length

        ? state.notifications
            .slice(0, 10)
            .map(notification => `
              <div class="notification-entry">

                <div class="notification-title">
                  ${escapeHTML(
                    notification.title
                  )}
                </div>

                <div class="notification-text">
                  ${escapeHTML(
                    notification.text
                  )}
                </div>

              </div>
            `)
            .join("")

        : `
          <div class="empty-state">
            NO SYSTEM NOTIFICATIONS
          </div>
        `;
  }


  /* =========================================================
     PERSONNEL
  ========================================================== */

  function renderPersonnel() {

    const tbody =
      document.getElementById(
        "personnelTable"
      );

    if (!tbody) return;


    const search =
      document.getElementById(
        "personnelSearch"
      ).value.toLowerCase();


    const filter =
      document.getElementById(
        "personnelStatusFilter"
      ).value;


    const people =
      Object.values(state.personnel)
        .filter(person => {

          const matchesSearch =
            person.id
              .toLowerCase()
              .includes(search) ||

            person.type
              .toLowerCase()
              .includes(search);


          const matchesStatus =
            filter === "ALL" ||
            person.status === filter;


          return (
            matchesSearch &&
            matchesStatus
          );
        });


    tbody.innerHTML =
      people.map(person => {

        const canView =
          hasClearance(1) ||
          person.id === currentUser;


        if (!canView) return "";


        return `
          <tr>

            <td>
              <strong>
                ${escapeHTML(person.id)}
              </strong>
            </td>

            <td>
              ${escapeHTML(person.type)}
            </td>

            <td>
              ${escapeHTML(person.status)}
            </td>

            <td>
              CL ${person.clearance}
              //
              ${escapeHTML(
                CLEARANCE_NAMES[
                  person.clearance
                ]
              )}
            </td>

            <td>
              ${escapeHTML(
                formattedDate(
                  person.last_access
                )
              )}
            </td>

            <td>
              <button
                class="admin-action-button"
                onclick="openPersonnel('${person.id}')"
              >
                VIEW
              </button>
            </td>

          </tr>
        `;
      }).join("");


    if (!tbody.innerHTML) {

      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              NO RECORDS FOUND
            </div>
          </td>
        </tr>
      `;
    }


    document.getElementById(
      "personnelSearch"
    ).oninput = renderPersonnel;


    document.getElementById(
      "personnelStatusFilter"
    ).onchange = renderPersonnel;
  }


  /* =========================================================
     PERSONNEL PROFILE
  ========================================================== */

  window.openPersonnel = function(id) {

    const person =
      state.personnel[id];

    if (!person) return;


    if (
      !hasClearance(1) &&
      id !== currentUser
    ) {

      showAlert("ACCESS DENIED");

      securityEvent(
        "ACCESS_DENIED",
        id,
        "Personnel record."
      );

      return;
    }


    currentPersonnelTarget = id;


    const isSelf =
      id === currentUser;


    const canAdmin =
      isAdmin() &&
      hasClearance(4);


    document.getElementById(
      "personnelModalContent"
    ).innerHTML = `

      <div class="profile-header">

        <div>

          <div class="profile-id">
            ${escapeHTML(person.id)}
          </div>

          <div class="profile-type">
            ${escapeHTML(person.type)}
          </div>

        </div>

        <div class="profile-clearance">
          CL ${person.clearance}
          //
          ${escapeHTML(
            CLEARANCE_NAMES[
              person.clearance
            ]
          )}
        </div>

      </div>


      <div class="profile-grid">

        <div class="profile-field">
          <span>STATUS</span>
          <strong>
            ${escapeHTML(person.status)}
          </strong>
        </div>

        <div class="profile-field">
          <span>ACCOUNT CREATED</span>
          <strong>
            ${escapeHTML(
              String(person.created || "UNKNOWN")
            )}
          </strong>
        </div>

        <div class="profile-field">
          <span>LAST ACCESS</span>
          <strong>
            ${escapeHTML(
              formattedDate(
                person.last_access
              )
            )}
          </strong>
        </div>

        <div class="profile-field">
          <span>PASSWORD CHANGE REQUIRED</span>
          <strong>
            ${
              person.force_password_change
                ? "YES"
                : "NO"
            }
          </strong>
        </div>

      </div>


      <div class="admin-actions">

        ${
          isSelf || canAdmin

            ? `
              <button
                class="admin-action-button"
                onclick="openClearanceModal('${person.id}')"
              >
                CHANGE CLEARANCE LEVEL
              </button>
            `

            : ""
        }


        ${
          canAdmin && !isSelf

            ? `

              <button
                class="admin-action-button"
                onclick="adminAction(
                  'resetPassword',
                  '${person.id}'
                )"
              >
                RESET PASSWORD
              </button>

              <button
                class="admin-action-button"
                onclick="adminAction(
                  'forcePassword',
                  '${person.id}'
                )"
              >
                FORCE PASSWORD CHANGE
              </button>

              <button
                class="admin-action-button"
                onclick="adminAction(
                  'lock',
                  '${person.id}'
                )"
              >
                LOCK ACCOUNT
              </button>

              <button
                class="admin-action-button"
                onclick="adminAction(
                  'suspend',
                  '${person.id}'
                )"
              >
                SUSPEND ACCOUNT
              </button>

              <button
                class="admin-action-button success"
                onclick="adminAction(
                  'activate',
                  '${person.id}'
                )"
              >
                REACTIVATE
              </button>

            `

            : ""
        }

      </div>
    `;


    document.getElementById(
      "personnelModal"
    ).classList.remove("hidden");
  };


  /* =========================================================
     CLEARANCE
  ========================================================== */

  window.openClearanceModal =
    function(id) {

      const person =
        state.personnel[id];

      if (!person) return;


      if (
        id !== currentUser &&
        !isAdmin()
      ) {

        showAlert(
          "ADMINISTRATIVE AUTHORIZATION REQUIRED"
        );

        return;
      }


      if (
        id !== currentUser &&
        !hasClearance(4)
      ) {

        showAlert(
          "CLEARANCE 4 REQUIRED"
        );

        return;
      }


      currentPersonnelTarget = id;


      document.getElementById(
        "clearanceTargetInfo"
      ).innerHTML = `
        <div class="profile-field">

          <span>TARGET</span>

          <strong>
            ${escapeHTML(id)}
          </strong>

        </div>
      `;


      const select =
        document.getElementById(
          "clearanceSelect"
        );


      select.innerHTML = "";


      for (let level = 0; level <= 5; level++) {

        if (
          currentUser === "D-64-ADM-02" &&
          level === 5
        ) continue;


        select.innerHTML += `
          <option value="${level}">
            ${level} — ${
              CLEARANCE_NAMES[level]
            }
          </option>
        `;
      }


      select.value =
        person.clearance;


      document.getElementById(
        "clearancePassword"
      ).value = "";


      document.getElementById(
        "clearanceError"
      ).textContent = "";


      document.getElementById(
        "clearanceModal"
      ).classList.remove("hidden");
    };


  document.getElementById(
    "confirmClearanceChange"
  ).addEventListener(
    "click",
    async () => {

      const target =
        state.personnel[
          currentPersonnelTarget
        ];

      if (!target) return;


      const newLevel =
        Number(
          document.getElementById(
            "clearanceSelect"
          ).value
        );


      const error =
        document.getElementById(
          "clearanceError"
        );


      if (
        currentUser === "D-64-ADM-02" &&
        newLevel === 5
      ) {

        error.textContent =
          "SECONDARY ADMIN CANNOT GRANT CLEARANCE 5.";

        return;
      }


      if (
        target.id !== currentUser &&
        !hasClearance(4)
      ) {

        error.textContent =
          "CLEARANCE 4 REQUIRED.";

        return;
      }


      const previous =
        Number(target.clearance);


      const { error: updateError } =
        await supabaseClient
          .from("personnel")
          .update({
            clearance: newLevel
          })
          .eq("id", target.id);


      if (updateError) {

        console.error(updateError);

        error.textContent =
          "DATABASE UPDATE FAILED.";

        return;
      }


      await audit(
        "CLEARANCE_MODIFICATION",
        target.id,
        `CL ${previous} -> CL ${newLevel}`
      );


      await securityEvent(
        "CLEARANCE_CHANGED",
        target.id,
        `CL ${previous} -> CL ${newLevel}`
      );


      await addNotification(
        "CLEARANCE UPDATED",
        `${target.id}: CL ${previous} -> CL ${newLevel}`
      );


      await loadDatabase();


      currentPersonnel =
        state.personnel[currentUser];


      document.getElementById(
        "clearanceModal"
      ).classList.add("hidden");


      showAlert(
        `CLEARANCE UPDATED // ${target.id} // CL ${newLevel}`
      );


      renderAll();
    }
  );


  /* =========================================================
     ARCHIVES
  ========================================================== */

  function renderArchives() {

    document.querySelectorAll(
      ".archive-card"
    ).forEach(card => {

      const required =
        Number(card.dataset.clearance);


      card.style.opacity =
        hasClearance(required)
          ? "1"
          : ".42";
    });
  }


  document.querySelectorAll(
    ".archive-card"
  ).forEach(card => {

    card.addEventListener(
      "click",
      async () => {

        const required =
          Number(card.dataset.clearance);


        if (!hasClearance(required)) {

          showAlert(
            `ACCESS DENIED // CLEARANCE ${required} REQUIRED`
          );

          await securityEvent(
            "ARCHIVE_ACCESS_DENIED",
            card.innerText.trim(),
            `Required clearance: ${required}`
          );

          return;
        }


        const file =
          state.files.find(
            f =>
              Number(f.clearance) === required
          );


        if (!file) {

          showAlert(
            "ARCHIVE RECORD NOT FOUND"
          );

          return;
        }


        document.getElementById(
          "archiveViewer"
        ).classList.remove("hidden");


        document.getElementById(
          "archiveContent"
        ).innerHTML = `

          <div class="profile-field">

            <span>FILE IDENTIFICATION</span>

            <strong>
              ${escapeHTML(file.id)}
            </strong>

          </div>

          <br>

          <div class="profile-field">

            <span>CLASSIFICATION</span>

            <strong>
              ${escapeHTML(file.classification)}
            </strong>

          </div>

          <br>

          <div class="profile-field">

            <span>TITLE</span>

            <strong>
              ${escapeHTML(file.title)}
            </strong>

          </div>

          <br>

          <div class="profile-field">

            <span>CONTENT</span>

            <strong>
              ${escapeHTML(file.content)}
            </strong>

          </div>
        `;


        await audit(
          "FILE_ACCESS",
          file.id,
          `Classification: ${file.classification}`
        );
      }
    );
  });


  /* =========================================================
     OPERATIONS
  ========================================================== */

  function renderOperations() {

    const container =
      document.getElementById(
        "operationsList"
      );

    const list =
      state.operations.filter(
        operation =>
          String(operation.status)
            .toLowerCase() ===
          currentOperationTab
      );


    container.innerHTML =
      list.length

        ? list.map(operation => `

          <div class="operation-card">

            <div class="operation-card-header">

              <div>

                <div class="operation-id">
                  ${escapeHTML(
                    operation.id
                  )}
                </div>

                <div class="operation-title">
                  ${escapeHTML(
                    operation.title
                  )}
                </div>

              </div>

              <div class="operation-status">
                ${escapeHTML(
                  operation.status
                )}
              </div>

            </div>

            <div class="operation-description">
              ${escapeHTML(
                operation.description
              )}
            </div>

          </div>

        `).join("")

        : `
          <div class="empty-state">
            NO ${
              currentOperationTab.toUpperCase()
            } OPERATIONS
          </div>
        `;
  }


  document.querySelectorAll(
    ".operation-tab"
  ).forEach(button => {

    button.addEventListener(
      "click",
      () => {

        currentOperationTab =
          button.dataset.operation;


        document.querySelectorAll(
          ".operation-tab"
        ).forEach(b =>
          b.classList.remove("active")
        );


        button.classList.add("active");

        renderOperations();
      }
    );
  });


  /* =========================================================
     SECURITY
  ========================================================== */

  function renderSecurity() {

    const activeSessions =
      state.sessions.filter(
        session => session.active
      );


    document.getElementById(
      "securitySessions"
    ).textContent =
      activeSessions.length;


    document.getElementById(
      "failedLogins"
    ).textContent =
      state.securityEvents.filter(
        event =>
          event.type === "LOGIN_FAILURE"
      ).length;


    document.getElementById(
      "lockedAccounts"
    ).textContent =
      Object.values(
        state.personnel
      ).filter(
        person =>
          person.status === "LOCKED"
      ).length;


    document.getElementById(
      "securityEvents"
    ).textContent =
      state.securityEvents.length;


    const content =
      document.getElementById(
        "securityContent"
      );


    if (currentSecurityTab === "sessions") {

      content.innerHTML =
        activeSessions.length

          ? activeSessions.map(
              session => `

                <div class="session-entry">

                  <div class="session-user">
                    ${escapeHTML(
                      session.personnel_id
                    )}
                  </div>

                  <div class="session-info">
                    LOGIN
                    ${escapeHTML(
                      formattedDate(
                        session.login_time
                      )
                    )}
                  </div>

                  <div class="session-active">
                    ACTIVE
                  </div>

                  ${
                    isAdmin() &&
                    session.personnel_id !==
                      currentUser

                      ? `
                        <button
                          class="admin-action-button danger"
                          onclick="terminateSession('${session.id}')"
                        >
                          TERMINATE
                        </button>
                      `

                      : ""
                  }

                </div>
              `
            ).join("")

          : `
            <div class="empty-state">
              NO ACTIVE SESSIONS
            </div>
          `;
    }


    if (currentSecurityTab === "logins") {

      const logs =
        state.audit.filter(
          entry =>
            entry.action === "LOGIN" ||
            entry.action === "LOGOUT" ||
            entry.action === "LOGIN_FAILURE"
        );


      content.innerHTML =
        logs.length
          ? logs.map(renderAuditEntry).join("")
          : `
            <div class="empty-state">
              NO LOGIN HISTORY
            </div>
          `;
    }


    if (currentSecurityTab === "denials") {

      const denials =
        state.securityEvents.filter(
          event =>
            String(event.type)
              .includes("DENIED") ||
            String(event.type)
              .includes("FAILURE")
        );


      content.innerHTML =
        denials.length
          ? denials.map(
              entry => `
                <div class="audit-entry">

                  <div class="audit-time">
                    ${escapeHTML(
                      formattedDate(
                        entry.timestamp
                      )
                    )}
                  </div>

                  <div class="audit-user">
                    ${escapeHTML(
                      entry.user_id || "-"
                    )}
                  </div>

                  <div class="audit-action">
                    ${escapeHTML(
                      entry.type
                    )}
                    //
                    ${escapeHTML(
                      entry.target
                    )}
                  </div>

                  <div class="audit-status">
                    DENIED
                  </div>

                </div>
              `
            ).join("")

          : `
            <div class="empty-state">
              NO ACCESS DENIALS
            </div>
          `;
    }


    if (currentSecurityTab === "events") {

      content.innerHTML =
        state.securityEvents.length
          ? state.securityEvents
              .map(
                entry => `
                  <div class="audit-entry">

                    <div class="audit-time">
                      ${escapeHTML(
                        formattedDate(
                          entry.timestamp
                        )
                      )}
                    </div>

                    <div class="audit-user">
                      ${escapeHTML(
                        entry.user_id || "-"
                      )}
                    </div>

                    <div class="audit-action">
                      ${escapeHTML(
                        entry.type
                      )}
                      //
                      ${escapeHTML(
                        entry.target
                      )}
                    </div>

                    <div class="audit-status">
                      LOGGED
                    </div>

                  </div>
                `
              )
              .join("")

          : `
            <div class="empty-state">
              NO SECURITY EVENTS
            </div>
          `;
    }


    if (currentSecurityTab === "clearance") {

      const changes =
        state.audit.filter(
          entry =>
            entry.action ===
            "CLEARANCE_MODIFICATION"
        );


      content.innerHTML =
        changes.length
          ? changes
              .map(renderAuditEntry)
              .join("")

          : `
            <div class="empty-state">
              NO CLEARANCE CHANGES
            </div>
          `;
    }
  }


  function renderAuditEntry(entry) {

    return `
      <div class="audit-entry">

        <div class="audit-time">
          ${escapeHTML(
            formattedDate(
              entry.timestamp
            )
          )}
        </div>

        <div class="audit-user">
          ${escapeHTML(
            entry.user_id || "-"
          )}
        </div>

        <div class="audit-action">
          ${escapeHTML(
            entry.action
          )}
          //
          ${escapeHTML(
            entry.target
          )}
          <br>
          ${escapeHTML(
            entry.details
          )}
        </div>

        <div class="audit-status">
          ${escapeHTML(
            entry.status
          )}
        </div>

      </div>
    `;
  }


  document.querySelectorAll(
    "[data-security-tab]"
  ).forEach(button => {

    button.addEventListener(
      "click",
      () => {

        currentSecurityTab =
          button.dataset.securityTab;


        document.querySelectorAll(
          "[data-security-tab]"
        ).forEach(b =>
          b.classList.remove("active")
        );


        button.classList.add("active");

        renderSecurity();
      }
    );
  });


  /* =========================================================
     SESSION TERMINATION
  ========================================================== */

  window.terminateSession =
    async function(sessionId) {

      if (!isAdmin()) {

        showAlert(
          "ADMINISTRATIVE AUTHORIZATION REQUIRED"
        );

        return;
      }


      const session =
        state.sessions.find(
          item => item.id === sessionId
        );


      if (!session) return;


      requestConfirmation(
        "TERMINATE ACTIVE SESSION",
        `Terminate session belonging to ${
          session.personnel_id
        }?`,
        async () => {

          await supabaseClient
            .from("personnel_sessions")
            .update({
              active: false,
              logout_time: now()
            })
            .eq("id", sessionId);


          await audit(
            "REMOTE_SESSION_TERMINATION",
            session.personnel_id,
            `Session ${sessionId}`
          );


          await securityEvent(
            "REMOTE_SESSION_TERMINATED",
            session.personnel_id,
            `Session ${sessionId}`
          );


          await loadDatabase();
          renderAll();


          showAlert(
            `SESSION TERMINATED // ${
              session.personnel_id
            }`
          );
        }
      );
    };


  /* =========================================================
     BLACKLIST
  ========================================================== */

  function renderBlacklist() {

    const list =
      document.getElementById(
        "blacklistList"
      );


    list.innerHTML =
      state.blacklist.length

        ? state.blacklist.map(
            entry => `

              <div class="blacklist-entry">

                <div class="blacklist-target">
                  ${escapeHTML(
                    entry.target
                  )}
                </div>

                <div class="blacklist-classification">
                  ${escapeHTML(
                    entry.classification
                  )}
                </div>

                <div class="blacklist-reason">
                  ${escapeHTML(
                    entry.reason
                  )}
                </div>

                <div class="blacklist-status">
                  ACTIVE
                </div>

              </div>
            `
          ).join("")

        : `
          <div class="empty-state">
            NO ACTIVE BLACKLIST ENTRIES
          </div>
        `;


    const requests =
      document.getElementById(
        "blacklistRequests"
      );


    if (!hasClearance(4)) {

      requests.innerHTML = `
        <div class="access-denied">

          <strong>
            ACCESS DENIED
          </strong>

          <span>
            CLEARANCE 4 REQUIRED
          </span>

        </div>
      `;

      return;
    }


    const visibleRequests =
      state.blacklistRequests;


    requests.innerHTML =
      visibleRequests.length

        ? visibleRequests.map(
            request => `

              <div class="blacklist-entry">

                <div>

                  <div class="blacklist-target">
                    ${escapeHTML(
                      request.target
                    )}
                  </div>

                  <div class="blacklist-classification">
                    ${escapeHTML(
                      request.classification
                    )}
                  </div>

                </div>

                <div class="blacklist-reason">
                  ${escapeHTML(
                    request.reason
                  )}
                </div>

                <div>

                  <div class="blacklist-status">
                    ${escapeHTML(
                      request.status
                    )}
                  </div>

                  <small>
                    ${escapeHTML(
                      request.requester_id ||
                      request.requester ||
                      "-"
                    )}
                  </small>

                </div>

                ${
                  hasClearance(5) &&
                  request.status === "PENDING"

                    ? `

                      <div class="admin-actions">

                        <button
                          class="admin-action-button success"
                          onclick="approveBlacklist('${request.id}')"
                        >
                          APPROVE
                        </button>

                        <button
                          class="admin-action-button danger"
                          onclick="denyBlacklist('${request.id}')"
                        >
                          DENY
                        </button>

                      </div>

                    `

                    : ""
                }

              </div>
            `
          ).join("")

        : `
          <div class="empty-state">
            NO PENDING REQUESTS
          </div>
        `;
  }


  document.getElementById(
    "blacklistRequestButton"
  ).addEventListener(
    "click",
    () => {

      if (!hasClearance(4)) {

        showAlert(
          "CLEARANCE 4 REQUIRED"
        );

        return;
      }


      populatePersonnelSelect(
        document.getElementById(
          "blacklistTarget"
        )
      );


      document.getElementById(
        "blacklistReason"
      ).value = "";


      document.getElementById(
        "blacklistRequestModal"
      ).classList.remove("hidden");
    }
  );


  document.getElementById(
    "submitBlacklistRequest"
  ).addEventListener(
    "click",
    async () => {

      if (!hasClearance(4)) return;


      const target =
        document.getElementById(
          "blacklistTarget"
        ).value;


      const classification =
        document.getElementById(
          "blacklistClassification"
        ).value;


      const reason =
        document.getElementById(
          "blacklistReason"
        ).value.trim();


      if (!target || !reason) {

        showAlert(
          "TARGET AND JUSTIFICATION REQUIRED"
        );

        return;
      }


      const { error } =
        await supabaseClient
          .from("blacklist_requests")
          .insert({
            target,
            classification,
            reason,
            requester_id: currentUser,
            status: "PENDING"
          });


      if (error) {

        console.error(error);

        showAlert(
          "BLACKLIST REQUEST FAILED"
        );

        return;
      }


      await audit(
        "BLACKLIST_REQUEST",
        target,
        classification
      );


      await securityEvent(
        "BLACKLIST_REQUEST_CREATED",
        target,
        classification
      );


      await addNotification(
        "BLACKLIST REQUEST",
        `${currentUser} submitted a request concerning ${target}.`
      );


      await loadDatabase();


      document.getElementById(
        "blacklistRequestModal"
      ).classList.add("hidden");


      renderBlacklist();


      showAlert(
        "BLACKLIST REQUEST SUBMITTED"
      );
    }
  );


  /* =========================================================
     BLACKLIST TERMINAL
  ========================================================== */

  document.getElementById(
    "blacklistTerminalButton"
  ).addEventListener(
    "click",
    () => {

      if (!hasClearance(5)) {

        showAlert(
          "CLEARANCE 5 REQUIRED"
        );

        return;
      }


      populatePersonnelSelect(
        document.getElementById(
          "terminalTarget"
        )
      );


      document.getElementById(
        "terminalReason"
      ).value = "";


      document.getElementById(
        "blacklistTerminalModal"
      ).classList.remove("hidden");
    }
  );


  document.getElementById(
    "executeBlacklistAction"
  ).addEventListener(
    "click",
    () => {

      if (!hasClearance(5)) return;


      const target =
        document.getElementById(
          "terminalTarget"
        ).value;


      const action =
        document.getElementById(
          "terminalAction"
        ).value;


      const reason =
        document.getElementById(
          "terminalReason"
        ).value.trim();


      if (!target || !reason) {

        document.getElementById(
          "terminalStatus"
        ).textContent =
          "TARGET AND AUTHORIZATION RECORD REQUIRED.";

        return;
      }


      requestConfirmation(
        `BLACKLIST ${action}`,
        `Execute ${action.toLowerCase()} operation against ${target}?`,
        async () => {

          if (action === "ADD") {

            const { data: existing } =
              await supabaseClient
                .from("blacklist_entries")
                .select("id")
                .eq("target", target)
                .maybeSingle();


            if (!existing) {

              await supabaseClient
                .from("blacklist_entries")
                .insert({
                  target,
                  classification: "OVERWATCH",
                  reason
                });
            }

          } else {

            await supabaseClient
              .from("blacklist_entries")
              .delete()
              .eq("target", target);
          }


          await audit(
            `BLACKLIST_${action}`,
            target,
            reason
          );


          await securityEvent(
            `BLACKLIST_${action}`,
            target,
            reason
          );


          await addNotification(
            "BLACKLIST UPDATED",
            `${target}: ${action}`
          );


          await loadDatabase();


          document.getElementById(
            "blacklistTerminalModal"
          ).classList.add("hidden");


          renderAll();


          showAlert(
            `BLACKLIST ${action} COMPLETED`
          );
        }
      );
    }
  );


  /* =========================================================
     APPROVE BLACKLIST
  ========================================================== */

  window.approveBlacklist =
    async function(id) {

      if (!hasClearance(5)) return;


      const request =
        state.blacklistRequests.find(
          item => item.id === id
        );


      if (!request) return;


      if (request.status !== "PENDING") {

        showAlert(
          "REQUEST ALREADY PROCESSED"
        );

        return;
      }


      await supabaseClient
        .from("blacklist_requests")
        .update({
          status: "APPROVED",
          approved_by: currentUser,
          approved_at: now()
        })
        .eq("id", id);


      const { data: existing } =
        await supabaseClient
          .from("blacklist_entries")
          .select("id")
          .eq("target", request.target)
          .maybeSingle();


      if (!existing) {

        await supabaseClient
          .from("blacklist_entries")
          .insert({
            target: request.target,
            classification:
              request.classification,
            reason: request.reason
          });
      }


      await audit(
        "BLACKLIST_REQUEST_APPROVED",
        request.target,
        `Request ${id}`
      );


      await securityEvent(
        "BLACKLIST_APPROVED",
        request.target,
        `Request ${id}`
      );


      await addNotification(
        "BLACKLIST REQUEST APPROVED",
        `${request.target} has been added to the active blacklist.`
      );


      await loadDatabase();
      renderAll();


      showAlert(
        "BLACKLIST REQUEST APPROVED"
      );
    };


  /* =========================================================
     DENY BLACKLIST
  ========================================================== */

  window.denyBlacklist =
    async function(id) {

      if (!hasClearance(5)) return;


      const request =
        state.blacklistRequests.find(
          item => item.id === id
        );


      if (!request) return;


      await supabaseClient
        .from("blacklist_requests")
        .update({
          status: "DENIED",
          denied_by: currentUser,
          denied_at: now()
        })
        .eq("id", id);


      await audit(
        "BLACKLIST_REQUEST_DENIED",
        request.target,
        `Request ${id}`
      );


      await securityEvent(
        "BLACKLIST_DENIED",
        request.target,
        `Request ${id}`
      );


      await loadDatabase();
      renderAll();


      showAlert(
        "BLACKLIST REQUEST DENIED"
      );
    };


  /* =========================================================
     ADMINISTRATION
  ========================================================== */

  function renderAdministration() {

    if (!hasClearance(4)) return;


    const people =
      Object.values(state.personnel);


    document.getElementById(
      "adminAccountCount"
    ).textContent =
      people.length;


    document.getElementById(
      "adminActiveCount"
    ).textContent =
      people.filter(
        p => p.status === "ACTIVE"
      ).length;


    document.getElementById(
      "adminLockedCount"
    ).textContent =
      people.filter(
        p => p.status === "LOCKED"
      ).length;


    document.getElementById(
      "adminEventCount"
    ).textContent =
      state.audit.filter(
        entry =>
          String(entry.action)
            .startsWith("ACCOUNT_") ||

          String(entry.action)
            .startsWith("ADMIN_") ||

          String(entry.action)
            .includes("PASSWORD") ||

          String(entry.action)
            .includes("CLEARANCE")
      ).length;


    document.querySelectorAll(
      ".admin-function"
    ).forEach(button => {

      button.onclick = () =>
        openAdminFunction(
          button.dataset.adminFunction
        );

    });
  }


  /* =========================================================
     ADMIN FUNCTION PANEL
  ========================================================== */

  function openAdminFunction(functionName) {

    if (!hasClearance(4)) {

      showAlert(
        "ADMINISTRATIVE ACCESS DENIED"
      );

      return;
    }


    const workspace =
      document.getElementById(
        "adminWorkspace"
      );


    const content =
      document.getElementById(
        "adminWorkspaceContent"
      );


    workspace.classList.remove("hidden");


    if (functionName === "accounts") {

      content.innerHTML = `

        <div class="admin-section-title">
          ACCOUNT CONTROL
        </div>

        <div class="toolbar">

          <input
            id="adminAccountSearch"
            placeholder="SEARCH ACCOUNT..."
          >

        </div>

        <div class="table-container">

          <table class="data-table">

            <thead>

              <tr>
                <th>ID</th>
                <th>TYPE</th>
                <th>STATUS</th>
                <th>CL</th>
                <th>ACTIONS</th>
              </tr>

            </thead>

            <tbody id="adminAccountsTable">
            </tbody>

          </table>

        </div>
      `;


      renderAdminAccounts();


      document.getElementById(
        "adminAccountSearch"
      ).addEventListener(
        "input",
        renderAdminAccounts
      );
    }


    if (functionName === "clearance") {

      content.innerHTML = `

        <div class="admin-section-title">
          CLEARANCE MANAGEMENT
        </div>

        <div class="admin-form-group">

          <label>
            TARGET PERSONNEL
          </label>

          <select id="adminClearanceTarget">
          </select>

        </div>

        <div class="admin-form-group">

          <label>
            NEW CLEARANCE
          </label>

          <select id="adminClearanceLevel">
          </select>

        </div>

        <div class="admin-actions">

          <button
            class="primary-button"
            style="width:auto"
            id="adminApplyClearance"
          >
            APPLY CLEARANCE
          </button>

        </div>
      `;


      populatePersonnelSelect(
        document.getElementById(
          "adminClearanceTarget"
        )
      );


      const select =
        document.getElementById(
          "adminClearanceLevel"
        );


      for (let i = 0; i <= 5; i++) {

        if (
          currentUser === "D-64-ADM-02" &&
          i === 5
        ) continue;


        select.innerHTML += `
          <option value="${i}">
            ${i} — ${CLEARANCE_NAMES[i]}
          </option>
        `;
      }


      document.getElementById(
        "adminApplyClearance"
      ).onclick = () => {

        const target =
          document.getElementById(
            "adminClearanceTarget"
          ).value;


        const level =
          Number(
            document.getElementById(
              "adminClearanceLevel"
            ).value
          );


        openClearanceModal(target);


        document.getElementById(
          "clearanceSelect"
        ).value = level;
      };
    }


    if (functionName === "passwords") {

      content.innerHTML = `

        <div class="admin-section-title">
          CREDENTIAL MANAGEMENT
        </div>

        <div class="admin-form-group">

          <label>
            TARGET ACCOUNT
          </label>

          <select id="passwordTarget">
          </select>

        </div>

        <div class="admin-actions">

          <button
            class="admin-action-button"
            id="adminResetPassword"
          >
            RESET PASSWORD
          </button>

          <button
            class="admin-action-button"
            id="adminForcePassword"
          >
            FORCE PASSWORD CHANGE
          </button>

        </div>
      `;


      populatePersonnelSelect(
        document.getElementById(
          "passwordTarget"
        )
      );


      document.getElementById(
        "adminResetPassword"
      ).onclick = () => {

        const target =
          document.getElementById(
            "passwordTarget"
          ).value;

        adminAction(
          "resetPassword",
          target
        );
      };


      document.getElementById(
        "adminForcePassword"
      ).onclick = () => {

        const target =
          document.getElementById(
            "passwordTarget"
          ).value;

        adminAction(
          "forcePassword",
          target
        );
      };
    }


    if (functionName === "sessions") {

      const sessions =
        state.sessions.filter(
          session => session.active
        );


      content.innerHTML = `

        <div class="admin-section-title">
          SESSION CONTROL
        </div>

        <div class="audit-list">

          ${
            sessions.length

              ? sessions.map(
                  session => `

                    <div class="session-entry">

                      <div class="session-user">
                        ${escapeHTML(
                          session.personnel_id
                        )}
                      </div>

                      <div class="session-info">
                        ${escapeHTML(
                          formattedDate(
                            session.login_time
                          )
                        )}
                      </div>

                      <div class="session-active">
                        ACTIVE
                      </div>

                      ${
                        session.personnel_id !==
                        currentUser

                          ? `
                            <button
                              class="admin-action-button danger"
                              onclick="terminateSession('${session.id}')"
                            >
                              TERMINATE
                            </button>
                          `

                          : ""
                      }

                    </div>
                  `
                ).join("")

              : `
                <div class="empty-state">
                  NO ACTIVE SESSIONS
                </div>
              `
          }

        </div>
      `;
    }


    if (functionName === "audit") {

      content.innerHTML = `

        <div class="admin-section-title">
          ADMINISTRATIVE AUDIT
        </div>

        <div class="audit-list">

          ${
            state.audit.length

              ? state.audit
                  .map(renderAuditEntry)
                  .join("")

              : `
                <div class="empty-state">
                  NO AUDIT DATA
                </div>
              `
          }

        </div>
      `;
    }


    if (functionName === "configuration") {

      content.innerHTML = `

        <div class="admin-section-title">
          SYSTEM CONFIGURATION
        </div>

        <div class="admin-form-grid">

          <div class="admin-form-group">

            <label>
              DATABASE STATUS
            </label>

            <select id="configDatabase">

              <option>ONLINE</option>
              <option>OFFLINE</option>
              <option>MAINTENANCE</option>

            </select>

          </div>

          <div class="admin-form-group">

            <label>
              AUTHENTICATION STATUS
            </label>

            <select id="configAuthentication">

              <option>ONLINE</option>
              <option>RESTRICTED</option>
              <option>MAINTENANCE</option>

            </select>

          </div>

        </div>

        <div class="admin-actions">

          <button
            class="primary-button"
            style="width:auto"
            id="saveConfiguration"
          >
            SAVE CONFIGURATION
          </button>

        </div>
      `;


      document.getElementById(
        "configDatabase"
      ).value =
        state.system.databaseStatus;


      document.getElementById(
        "configAuthentication"
      ).value =
        state.system.authenticationStatus;


      document.getElementById(
        "saveConfiguration"
      ).onclick = async () => {

        showAlert(
          "CONFIGURATION STORAGE WILL BE ENABLED IN ADMIN BACKEND PHASE."
        );
      };
    }


    if (functionName === "diagnostics") {

      content.innerHTML = `

        <div class="admin-section-title">
          SYSTEM DIAGNOSTICS
        </div>

        <div class="status-list">

          <div class="status-row">
            <span>DATABASE</span>
            <strong>
              ONLINE
            </strong>
          </div>

          <div class="status-row">
            <span>AUTHENTICATION</span>
            <strong>
              ONLINE
            </strong>
          </div>

          <div class="status-row">
            <span>AUDIT ENGINE</span>
            <strong>
              ONLINE
            </strong>
          </div>

          <div class="status-row">
            <span>BLACKLIST</span>
            <strong>
              ONLINE
            </strong>
          </div>

          <div class="status-row">
            <span>ARCHIVE SYSTEM</span>
            <strong>
              ONLINE
            </strong>
          </div>

        </div>

        <div class="admin-actions">

          <button
            class="admin-action-button"
            id="runDiagnostics"
          >
            RUN FULL DIAGNOSTICS
          </button>

        </div>
      `;


      document.getElementById(
        "runDiagnostics"
      ).onclick = async () => {

        await audit(
          "SYSTEM_DIAGNOSTICS",
          "MAINFRAME",
          "Full diagnostic scan executed."
        );


        showAlert(
          "DIAGNOSTICS COMPLETE // NO CRITICAL FAULTS"
        );
      };
    }


    if (functionName === "maintenance") {

      content.innerHTML = `

        <div class="admin-section-title">
          MAINTENANCE MODE
        </div>

        <div class="access-denied">

          <strong>
            MAINTENANCE MODE
          </strong>

          <span>
            SYSTEM CONFIGURATION CONTROL
          </span>

        </div>

        <div class="admin-actions">

          <button
            class="admin-action-button"
            id="toggleMaintenance"
          >
            TOGGLE MAINTENANCE
          </button>

        </div>
      `;


      document.getElementById(
        "toggleMaintenance"
      ).onclick = () => {

        showAlert(
          "MAINTENANCE CONTROL RESERVED FOR SYSTEM CONFIGURATION BACKEND."
        );
      };
    }


    if (functionName === "emergency") {

      if (!hasClearance(5)) {

        content.innerHTML = `
          <div class="access-denied">

            <strong>
              ACCESS DENIED
            </strong>

            <span>
              CLEARANCE 5 REQUIRED
            </span>

          </div>
        `;

        return;
      }


      content.innerHTML = `

        <div class="admin-section-title">
          EMERGENCY PROTOCOL
        </div>

        <div class="access-denied">

          <strong>
            EMERGENCY PROTOCOL
          </strong>

          <span>
            CLEARANCE 5 AUTHORIZATION REQUIRED
          </span>

        </div>

        <div class="admin-actions">

          <button
            class="danger-button"
            id="toggleEmergency"
          >
            CHANGE PROTOCOL STATE
          </button>

        </div>
      `;


      document.getElementById(
        "toggleEmergency"
      ).onclick = () => {

        showAlert(
          "EMERGENCY CONTROL RESERVED FOR SECURE BACKEND."
        );
      };
    }


    if (functionName === "storage") {

      content.innerHTML = `

        <div class="admin-section-title">
          STORAGE MANAGEMENT
        </div>

        <div class="stat-card">

          <span>
            MAINFRAME STORAGE
          </span>

          <strong>
            ${escapeHTML(
              state.system.storage
            )}%
          </strong>

          <small>
            CURRENT UTILIZATION
          </small>

        </div>

        <div class="admin-actions">

          <button
            class="admin-action-button"
            id="simulateStorage"
          >
            RUN STORAGE ANALYSIS
          </button>

        </div>
      `;


      document.getElementById(
        "simulateStorage"
      ).onclick = async () => {

        await audit(
          "STORAGE_ANALYSIS",
          "MAINFRAME",
          "Storage analysis executed."
        );


        showAlert(
          "STORAGE ANALYSIS COMPLETE"
        );
      };
    }


    if (functionName === "notifications") {

      content.innerHTML = `

        <div class="admin-section-title">
          SYSTEM NOTIFICATIONS
        </div>

        <div class="admin-form-group">

          <label>
            NOTIFICATION TITLE
          </label>

          <input
            id="adminNotificationTitle"
            placeholder="TITLE..."
          >

        </div>

        <div class="admin-form-group">

          <label>
            MESSAGE
          </label>

          <textarea
            id="adminNotificationText"
            rows="5"
            placeholder="MESSAGE..."
          ></textarea>

        </div>

        <div class="admin-actions">

          <button
            class="primary-button"
            style="width:auto"
            id="sendAdminNotification"
          >
            ISSUE NOTIFICATION
          </button>

        </div>
      `;


      document.getElementById(
        "sendAdminNotification"
      ).onclick = async () => {

        const title =
          document.getElementById(
            "adminNotificationTitle"
          ).value.trim();


        const text =
          document.getElementById(
            "adminNotificationText"
          ).value.trim();


        if (!title || !text) {

          showAlert(
            "TITLE AND MESSAGE REQUIRED"
          );

          return;
        }


        await addNotification(
          title,
          text
        );


        await audit(
          "ADMIN_NOTIFICATION",
          "SYSTEM",
          title
        );


        await loadDatabase();

        renderDashboard();


        showAlert(
          "SYSTEM NOTIFICATION ISSUED"
        );
      };
    }


    if (functionName === "auditExport") {

      if (!hasClearance(5)) {

        content.innerHTML = `
          <div class="access-denied">

            <strong>
              ACCESS DENIED
            </strong>

            <span>
              CLEARANCE 5 REQUIRED
            </span>

          </div>
        `;

        return;
      }


      content.innerHTML = `

        <div class="admin-section-title">
          AUDIT EXPORT
        </div>

        <div class="profile-field">

          <span>
            RECORDS AVAILABLE
          </span>

          <strong>
            ${state.audit.length}
          </strong>

        </div>

        <div class="admin-actions">

          <button
            class="admin-action-button"
            id="exportAudit"
          >
            EXPORT AUDIT RECORD
          </button>

        </div>
      `;


      document.getElementById(
        "exportAudit"
      ).onclick = exportAudit;
    }
  }


  /* =========================================================
     ADMIN ACCOUNT TABLE
  ========================================================== */

  function renderAdminAccounts() {

    const tbody =
      document.getElementById(
        "adminAccountsTable"
      );


    if (!tbody) return;


    const search =
      document.getElementById(
        "adminAccountSearch"
      )?.value
        .toLowerCase() || "";


    const people =
      Object.values(
        state.personnel
      ).filter(
        person =>
          person.id
            .toLowerCase()
            .includes(search)
      );


    tbody.innerHTML =
      people.map(person => `

        <tr>

          <td>
            ${escapeHTML(person.id)}
          </td>

          <td>
            ${escapeHTML(person.type)}
          </td>

          <td>
            ${escapeHTML(person.status)}
          </td>

          <td>
            CL ${person.clearance}
          </td>

          <td>

            <button
              class="admin-action-button"
              onclick="openPersonnel('${person.id}')"
            >
              VIEW
            </button>

          </td>

        </tr>

      `).join("");
  }


  /* =========================================================
     ADMIN ACTIONS
  ========================================================== */

  window.adminAction =
    async function(action, id) {

      if (
        !isAdmin() ||
        !hasClearance(4)
      ) {

        showAlert(
          "ADMINISTRATIVE AUTHORIZATION REQUIRED"
        );

        return;
      }


      const person =
        state.personnel[id];


      if (!person) return;


      if (id === currentUser) {

        showAlert(
          "SELF-ADMINISTRATION RESTRICTION"
        );

        return;
      }


      if (
        action === "lock" ||
        action === "suspend" ||
        action === "activate"
      ) {

        let newStatus =
          "ACTIVE";


        if (action === "lock")
          newStatus = "LOCKED";

        if (action === "suspend")
          newStatus = "SUSPENDED";


        requestConfirmation(
          `${action.toUpperCase()} ACCOUNT`,
          `Apply ${newStatus} status to ${id}?`,
          async () => {

            const { error } =
              await supabaseClient
                .from("personnel")
                .update({
                  status: newStatus
                })
                .eq("id", id);


            if (error) {

              console.error(error);

              showAlert(
                "ACCOUNT UPDATE FAILED"
              );

              return;
            }


            await audit(
              action === "lock"
                ? "ACCOUNT_LOCK"
                : action === "suspend"
                  ? "ACCOUNT_SUSPEND"
                  : "ACCOUNT_REACTIVATE",
              id,
              "Administrative action."
            );


            await securityEvent(
              action === "lock"
                ? "ACCOUNT_LOCKED"
                : action === "suspend"
                  ? "ACCOUNT_SUSPENDED"
                  : "ACCOUNT_REACTIVATED",
              id,
              "Administrative action."
            );


            await loadDatabase();
            renderAll();


            showAlert(
              `ACCOUNT ${newStatus} // ${id}`
            );
          }
        );

        return;
      }


      if (action === "forcePassword") {

        const { error } =
          await supabaseClient
            .from("personnel")
            .update({
              force_password_change: true
            })
            .eq("id", id);


        if (error) {

          console.error(error);

          showAlert(
            "PASSWORD FLAG UPDATE FAILED"
          );

          return;
        }


        await audit(
          "FORCE_PASSWORD_CHANGE",
          id,
          "Password change required at next authentication."
        );


        await addNotification(
          "PASSWORD CHANGE REQUIRED",
          `${id} must change credentials at next authentication.`
        );


        await loadDatabase();


        showAlert(
          `PASSWORD CHANGE FLAGGED // ${id}`
        );

        return;
      }


      if (action === "resetPassword") {

        /*
          IMPORTANT:
          A normal browser client cannot safely change
          another user's Supabase Auth password.

          This operation will be connected to a secure
          Supabase Edge Function in the next backend phase.
        */

        showAlert(
          "SECURE PASSWORD RESET BACKEND REQUIRED"
        );

        return;
      }
    };


  /* =========================================================
     PERSONNEL SELECT
  ========================================================== */

  function populatePersonnelSelect(select) {

    if (!select) return;


    select.innerHTML = "";


    Object.values(
      state.personnel
    ).forEach(person => {

      if (
        person.id === currentUser
      ) return;


      select.innerHTML += `
        <option value="${escapeHTML(
          person.id
        )}">
          ${escapeHTML(
            person.id
          )}
        </option>
      `;
    });
  }


  /* =========================================================
     GLOBAL SEARCH
  ========================================================== */

  document.getElementById(
    "globalSearchButton"
  ).addEventListener(
    "click",
    () => {

      if (!hasClearance(1)) {

        showAlert(
          "CLEARANCE 1 REQUIRED"
        );

        return;
      }


      document.getElementById(
        "globalSearchInput"
      ).value = "";


      document.getElementById(
        "globalSearchOverlay"
      ).classList.remove("hidden");


      document.getElementById(
        "globalSearchInput"
      ).focus();
    }
  );


  document.getElementById(
    "globalSearchInput"
  ).addEventListener(
    "input",
    event => {

      const query =
        event.target.value
          .trim()
          .toLowerCase();


      const results =
        document.getElementById(
          "globalSearchResults"
        );


      if (!query) {

        results.innerHTML = `
          <div class="empty-state">
            ENTER SEARCH PARAMETERS
          </div>
        `;

        return;
      }


      const found = [];


      Object.values(
        state.personnel
      ).forEach(person => {

        if (
          person.id
            .toLowerCase()
            .includes(query) ||

          person.type
            .toLowerCase()
            .includes(query)
        ) {

          if (
            hasClearance(1) ||
            person.id === currentUser
          ) {

            found.push({
              type: "PERSONNEL",
              title: person.id,
              details: person.type
            });
          }
        }
      });


      state.files.forEach(file => {

        if (
          file.title
            .toLowerCase()
            .includes(query) ||

          file.id
            .toLowerCase()
            .includes(query)
        ) {

          if (
            hasClearance(
              Number(file.clearance)
            )
          ) {

            found.push({
              type: "ARCHIVE",
              title: file.title,
              details: file.id
            });
          }
        }
      });


      state.operations.forEach(operation => {

        if (
          operation.title
            .toLowerCase()
            .includes(query) ||

          operation.id
            .toLowerCase()
            .includes(query)
        ) {

          if (hasClearance(2)) {

            found.push({
              type: "OPERATION",
              title: operation.title,
              details: operation.id
            });
          }
        }
      });


      results.innerHTML =
        found.length

          ? found
              .slice(0, 30)
              .map(result => `

                <div class="search-result">

                  <div class="search-result-type">
                    ${escapeHTML(
                      result.type
                    )}
                  </div>

                  <div class="search-result-title">
                    ${escapeHTML(
                      result.title
                    )}
                  </div>

                  <div class="notification-text">
                    ${escapeHTML(
                      result.details
                    )}
                  </div>

                </div>

              `)
              .join("")

          : `
            <div class="empty-state">
              NO MATCHING RECORDS
            </div>
          `;
    }
  );


  /* =========================================================
     MODALS
  ========================================================== */

  document.querySelectorAll(
    "[data-close]"
  ).forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const id =
          button.dataset.close;


        document.getElementById(id)
          ?.classList.add("hidden");
      }
    );
  });


  document.querySelectorAll(
    ".overlay"
  ).forEach(overlay => {

    overlay.addEventListener(
      "click",
      event => {

        if (
          event.target === overlay
        ) {
          overlay.classList.add("hidden");
        }
      }
    );
  });


  /* =========================================================
     CONFIRMATION
  ========================================================== */

  function requestConfirmation(
    title,
    message,
    callback
  ) {

    pendingConfirmation =
      callback;


    document.getElementById(
      "confirmationMessage"
    ).innerHTML = `

      <div class="profile-field">

        <span>
          ${escapeHTML(title)}
        </span>

        <strong>
          ${escapeHTML(message)}
        </strong>

      </div>
    `;


    document.getElementById(
      "confirmationModal"
    ).classList.remove("hidden");
  }


  document.getElementById(
    "cancelConfirmation"
  ).addEventListener(
    "click",
    () => {

      pendingConfirmation = null;

      document.getElementById(
        "confirmationModal"
      ).classList.add("hidden");
    }
  );


  document.getElementById(
    "confirmConfirmation"
  ).addEventListener(
    "click",
    async () => {

      const action =
        pendingConfirmation;


      pendingConfirmation = null;


      document.getElementById(
        "confirmationModal"
      ).classList.add("hidden");


      if (action) {
        await action();
      }
    }
  );


  /* =========================================================
     ALERT
  ========================================================== */

  function showAlert(message) {

    const alert =
      document.getElementById(
        "systemAlert"
      );


    if (!alert) return;


    document.getElementById(
      "systemAlertMessage"
    ).textContent =
      message;


    alert.classList.remove(
      "hidden"
    );


    clearTimeout(
      window.diviAlertTimer
    );


    window.diviAlertTimer =
      setTimeout(
        () =>
          alert.classList.add(
            "hidden"
          ),
        5000
      );
  }


  document.getElementById(
    "closeSystemAlert"
  ).addEventListener(
    "click",
    () =>
      document.getElementById(
        "systemAlert"
      ).classList.add("hidden")
  );


  /* =========================================================
     CLOCK
  ========================================================== */

  function updateClock() {

    const clock =
      document.getElementById(
        "systemClock"
      );


    if (!clock) return;


    clock.textContent =
      new Date().toLocaleTimeString(
        "en-GB",
        {
          hour12: false
        }
      );
  }


  setInterval(
    updateClock,
    1000
  );

  updateClock();


  /* =========================================================
     PERSONNEL REFRESH
  ========================================================== */

  document.getElementById(
    "personnelRefresh"
  ).addEventListener(
    "click",
    async () => {

      await loadDatabase();

      await audit(
        "PERSONNEL_DATABASE_REFRESH",
        "DATABASE",
        "Personnel database manually refreshed."
      );


      renderPersonnel();


      showAlert(
        "PERSONNEL DATABASE REFRESHED"
      );
    }
  );


  /* =========================================================
     AUDIT EXPORT
  ========================================================== */

  function exportAudit() {

    if (!hasClearance(5)) {

      showAlert(
        "CLEARANCE 5 REQUIRED"
      );

      return;
    }


    const data =
      JSON.stringify(
        state.audit,
        null,
        2
      );


    const blob =
      new Blob(
        [data],
        {
          type:
            "application/json"
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );


    const a =
      document.createElement(
        "a"
      );


    a.href = url;

    a.download =
      `DIVI64_AUDIT_${Date.now()}.json`;


    a.click();


    URL.revokeObjectURL(
      url
    );


    audit(
      "AUDIT_EXPORT",
      "MAINFRAME",
      "Audit records exported."
    );


    showAlert(
      "AUDIT RECORD EXPORTED"
    );
  }


  /* =========================================================
     SESSION RECOVERY
  ========================================================== */

  async function recoverSession() {

    const {
      data: {
        session
      }
    } =
      await supabaseClient.auth
        .getSession();


    if (!session?.user) {
      return false;
    }


    const {
      data: personnel,
      error
    } =
      await supabaseClient
        .from("personnel")
        .select("*")
        .eq(
          "auth_user_id",
          session.user.id
        )
        .single();


    if (error || !personnel) {

      await supabaseClient.auth.signOut();

      return false;
    }


    if (
      personnel.status !==
      "ACTIVE"
    ) {

      await supabaseClient.auth.signOut();

      return false;
    }


    currentUser =
      personnel.id;

    currentPersonnel =
      personnel;


    await loadDatabase();


    document.getElementById(
      "loginScreen"
    ).classList.add("hidden");


    document.getElementById(
      "mainSystem"
    ).classList.remove("hidden");


    updateHeader();
    renderAll();


    return true;
  }


  /* =========================================================
     SUPABASE AUTH STATE
  ========================================================== */

  supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

      if (
        event ===
        "SIGNED_OUT"
      ) {

        currentUser = null;
        currentPersonnel = null;
      }
    }
  );


  /* =========================================================
     INITIALIZATION
  ========================================================== */

  const connected =
    await loadDatabase();


  if (!connected) {

    console.error(
      "DIVI64 MAINFRAME: DATABASE OFFLINE"
    );

    return;
  }


  document.querySelectorAll(
    "[data-security-tab]"
  ).forEach(
    (button, index) => {

      button.classList.toggle(
        "active",
        index === 0
      );
    }
  );


  const recovered =
    await recoverSession();


  if (!recovered) {

    document.getElementById(
      "loginScreen"
    ).classList.remove(
      "hidden"
    );

    document.getElementById(
      "mainSystem"
    ).classList.add(
      "hidden"
    );
  }


  renderDashboard();

});
