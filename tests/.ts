import {
    Clarinet,
    Tx,
    Chain,
    Account,
    types
} from 'https://deno.land/x/clarinet@v1.0.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Doctor registration and verification flow",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const doctor = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('health-records', 'register-doctor', [
                types.ascii("Dr. Smith"),
                types.ascii("Cardiology"),
                types.ascii("MD12345")
            ], doctor.address),
            Tx.contractCall('health-records', 'verify-doctor', [
                types.principal(doctor.address)
            ], deployer.address)
        ]);
        
        block.receipts[0].result.expectOk();
        block.receipts[1].result.expectOk();
    }
});

Clarinet.test({
    name: "Patient record creation and doctor authorization",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const doctor = accounts.get('wallet_1')!;
        const patient = accounts.get('wallet_2')!;
        
        // First register and verify doctor
        let setupBlock = chain.mineBlock([
            Tx.contractCall('health-records', 'register-doctor', [
                types.ascii("Dr. Smith"),
                types.ascii("Cardiology"),
                types.ascii("MD12345")
            ], doctor.address),
            Tx.contractCall('health-records', 'verify-doctor', [
                types.principal(doctor.address)
            ], deployer.address)
        ]);
        
        // Create patient record and authorize doctor
        let block = chain.mineBlock([
            Tx.contractCall('health-records', 'create-patient-record', [
                types.utf8("No major illnesses"),
                types.utf8("Penicillin"),
                types.utf8("None")
            ], patient.address),
            Tx.contractCall('health-records', 'authorize-doctor', [
                types.principal(doctor.address)
            ], patient.address)
        ]);
        
        block.receipts[0].result.expectOk();
        block.receipts[1].result.expectOk();
    }
});

Clarinet.test({
    name: "Medical record update by authorized doctor",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const doctor = accounts.get('wallet_1')!;
        const patient = accounts.get('wallet_2')!;
        
        // Setup
        let setupBlock = chain.mineBlock([
            Tx.contractCall('health-records', 'register-doctor', [
                types.ascii("Dr. Smith"),
                types.ascii("Cardiology"),
                types.ascii("MD12345")
            ], doctor.address),
            Tx.contractCall('health-records', 'verify-doctor', [
                types.principal(doctor.address)
            ], deployer.address),
            Tx.contractCall('health-records', 'create-patient-record', [
                types.utf8("No major illnesses"),
                types.utf8("Penicillin"),
                types.utf8("None")
            ], patient.address),
            Tx.contractCall('health-records', 'authorize-doctor', [
                types.principal(doctor.address)
            ], patient.address)
        ]);
        
        // Update record
        let block = chain.mineBlock([
            Tx.contractCall('health-records', 'update-medical-record', [
                types.principal(patient.address),
                types.utf8("Diagnosed with hypertension"),
                types.utf8("Penicillin"),
                types.utf8("Lisinopril 10mg")
            ], doctor.address)
        ]);
        
        block.receipts[0].result.expectOk();
    }
});
