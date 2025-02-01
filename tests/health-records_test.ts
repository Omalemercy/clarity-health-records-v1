import {
    Clarinet,
    Tx,
    Chain,
    Account,
    types
} from 'https://deno.land/x/clarinet@v1.0.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Emergency contact registration and access test",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const patient = accounts.get('wallet_1')!;
        const emergency_contact = accounts.get('wallet_2')!;
        
        // Create patient record and add emergency contact
        let block = chain.mineBlock([
            Tx.contractCall('health-records', 'create-patient-record', [
                types.utf8("History of diabetes"),
                types.utf8("None"),
                types.utf8("Metformin")
            ], patient.address),
            Tx.contractCall('health-records', 'add-emergency-contact', [
                types.principal(emergency_contact.address)
            ], patient.address)
        ]);
        
        block.receipts[0].result.expectOk();
        block.receipts[1].result.expectOk();

        // Test emergency access
        let accessBlock = chain.mineBlock([
            Tx.contractCall('health-records', 'emergency-access', [
                types.principal(patient.address)
            ], emergency_contact.address)
        ]);
        
        accessBlock.receipts[0].result.expectOk();
    }
});

Clarinet.test({
    name: "Activity logging test",
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
        
        // Get activity log
        let logBlock = chain.mineBlock([
            Tx.contractCall('health-records', 'get-activity-log', [
                types.principal(patient.address)
            ], patient.address)
        ]);
        
        logBlock.receipts[0].result.expectOk();
    }
});
