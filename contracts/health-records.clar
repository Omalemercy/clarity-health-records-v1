;; Define data structures for health records
(define-map patient-records
    principal
    {
        medical-history: (string-utf8 1000),
        allergies: (string-utf8 500),
        current-medications: (string-utf8 500),
        last-updated: uint,
        authorized-doctors: (list 20 principal),
        emergency-contacts: (list 3 principal),
        activity-log: (list 50 {timestamp: uint, actor: principal, action: (string-ascii 50)})
    }
)

(define-map doctor-registry
    principal 
    {
        name: (string-ascii 50),
        specialty: (string-ascii 50),
        license-number: (string-ascii 20),
        verified: bool
    }
)

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-not-authorized (err u100))
(define-constant err-not-registered (err u101))
(define-constant err-already-registered (err u102))
(define-constant err-emergency-list-full (err u103))
(define-constant err-log-full (err u104))

;; Public functions
(define-public (register-doctor 
    (name (string-ascii 50))
    (specialty (string-ascii 50))
    (license-number (string-ascii 20)))
    (let ((doctor-data {
            name: name,
            specialty: specialty,
            license-number: license-number,
            verified: false
        }))
        (if (is-none (map-get? doctor-registry tx-sender))
            (ok (map-set doctor-registry tx-sender doctor-data))
            err-already-registered
        )
    )
)

(define-public (verify-doctor (doctor-principal principal))
    (if (is-eq tx-sender contract-owner)
        (let ((doctor-data (unwrap! (map-get? doctor-registry doctor-principal) err-not-registered)))
            (ok (map-set doctor-registry 
                doctor-principal 
                (merge doctor-data {verified: true}))))
        err-not-authorized
    )
)

(define-public (create-patient-record 
    (medical-history (string-utf8 1000))
    (allergies (string-utf8 500))
    (medications (string-utf8 500)))
    (ok (map-set patient-records tx-sender {
        medical-history: medical-history,
        allergies: allergies,
        current-medications: medications,
        last-updated: block-height,
        authorized-doctors: (list),
        emergency-contacts: (list),
        activity-log: (list)
    }))
)

(define-public (add-emergency-contact (contact principal))
    (let ((current-record (unwrap! (map-get? patient-records tx-sender) err-not-registered)))
        (ok (map-set patient-records 
            tx-sender 
            (merge current-record 
                {emergency-contacts: (unwrap! (as-max-len? 
                    (append (get emergency-contacts current-record) contact) u3)
                    err-emergency-list-full)})))
    )
)

(define-public (emergency-access (patient-principal principal))
    (let ((current-record (unwrap! (map-get? patient-records patient-principal) err-not-registered)))
        (if (is-emergency-contact tx-sender (get emergency-contacts current-record))
            (begin
                (try! (log-activity patient-principal tx-sender "emergency-access"))
                (ok current-record))
            err-not-authorized
        )
    )
)

(define-public (authorize-doctor (doctor-principal principal))
    (let ((current-record (unwrap! (map-get? patient-records tx-sender) err-not-registered))
          (doctor-data (unwrap! (map-get? doctor-registry doctor-principal) err-not-registered)))
        (if (get verified doctor-data)
            (begin 
                (try! (log-activity tx-sender tx-sender "authorize-doctor"))
                (ok (map-set patient-records 
                    tx-sender 
                    (merge current-record 
                        {authorized-doctors: (unwrap! (as-max-len? 
                            (append (get authorized-doctors current-record) doctor-principal) u20) 
                            err-not-authorized)}))))
            err-not-authorized
        )
    )
)

(define-public (update-medical-record 
    (patient-principal principal)
    (medical-history (string-utf8 1000))
    (allergies (string-utf8 500))
    (medications (string-utf8 500)))
    (let ((current-record (unwrap! (map-get? patient-records patient-principal) err-not-registered)))
        (if (is-authorized tx-sender (get authorized-doctors current-record))
            (begin
                (try! (log-activity patient-principal tx-sender "update-record"))
                (ok (map-set patient-records 
                    patient-principal
                    (merge current-record {
                        medical-history: medical-history,
                        allergies: allergies,
                        current-medications: medications,
                        last-updated: block-height
                    }))))
            err-not-authorized
        )
    )
)

;; Read only functions
(define-read-only (get-patient-record (patient principal))
    (let ((record (map-get? patient-records patient)))
        (if (and 
            (is-some record) 
            (or 
                (is-eq tx-sender patient)
                (is-authorized tx-sender (get authorized-doctors (unwrap-panic record)))
                (is-emergency-contact tx-sender (get emergency-contacts (unwrap-panic record)))
            ))
            (ok record)
            err-not-authorized
        )
    )
)

(define-read-only (get-doctor-info (doctor principal))
    (ok (map-get? doctor-registry doctor))
)

(define-read-only (get-activity-log (patient principal))
    (let ((record (unwrap! (map-get? patient-records patient) err-not-registered)))
        (if (or (is-eq tx-sender patient)
                (is-authorized tx-sender (get authorized-doctors record)))
            (ok (get activity-log record))
            err-not-authorized
        )
    )
)

;; Private functions
(define-private (is-authorized (caller principal) (authorized-list (list 20 principal)))
    (is-some (index-of authorized-list caller))
)

(define-private (is-emergency-contact (caller principal) (emergency-list (list 3 principal)))
    (is-some (index-of emergency-list caller))
)

(define-private (log-activity (patient principal) (actor principal) (action (string-ascii 50)))
    (let ((current-record (unwrap! (map-get? patient-records patient) err-not-registered))
          (new-log-entry {timestamp: block-height, actor: actor, action: action}))
        (ok (map-set patient-records
            patient
            (merge current-record 
                {activity-log: (unwrap! (as-max-len?
                    (append (get activity-log current-record) new-log-entry) u50)
                    err-log-full)})))
    )
)
