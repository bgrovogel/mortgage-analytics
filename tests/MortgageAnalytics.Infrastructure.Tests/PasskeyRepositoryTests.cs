using MortgageAnalytics.Application.Passkeys;

namespace MortgageAnalytics.Infrastructure.Tests;

[TestFixture]
public class PasskeyRepositoryTests : RepositoryTestBase
{
    private static Passkey APasskey(string owner = Alice, byte id = 1, string name = "Laptop", int minutesLater = 0) => new()
    {
        CredentialId = [id, 2, 3], OwnerId = owner, PublicKey = [9, 8, 7, id], UserHandle = [4, 5, 6],
        SignCount = 0, Name = name, CreatedAt = TestClock.Now.AddMinutes(minutesLater),
    };

    [Test]
    public async Task APasskey_ComesBackByItsCredentialId_WithEverythingKept()
    {
        await NewPasskeys().AddAsync(APasskey(), CancellationToken.None);

        var found = await NewPasskeys().FindAsync([1, 2, 3], CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(found?.OwnerId, Is.EqualTo(Alice), "its owner");
            Assert.That(found?.PublicKey, Is.EqualTo(new byte[] { 9, 8, 7, 1 }), "the public key, byte for byte");
            Assert.That(found?.UserHandle, Is.EqualTo(new byte[] { 4, 5, 6 }), "the user handle");
            Assert.That(found?.Name, Is.EqualTo("Laptop"), "the name it was given");
            Assert.That(found?.CreatedAt, Is.EqualTo(TestClock.Now), "when it was registered");
            Assert.That(found?.LastUsedAt, Is.Null, "never used yet");
        });
    }

    [Test]
    public async Task ACredentialIdNobodyRegistered_IsNotFound() =>
        Assert.That(await NewPasskeys().FindAsync([7, 7, 7], CancellationToken.None), Is.Null, "no such passkey");

    [Test]
    public async Task TheSameCredentialId_CannotBeRegisteredTwice()
    {
        await NewPasskeys().AddAsync(APasskey(), CancellationToken.None);

        Assert.That(async () => await NewPasskeys().AddAsync(APasskey(Bob), CancellationToken.None), Throws.Exception,
            "a credential id belongs to one passkey, whoever tries to register it again");
    }

    [Test]
    public async Task ListingShowsOnlyTheOwnersPasskeys_OldestFirst()
    {
        await NewPasskeys().AddAsync(APasskey(id: 2, name: "Phone", minutesLater: 5), CancellationToken.None);
        await NewPasskeys().AddAsync(APasskey(id: 1, name: "Laptop"), CancellationToken.None);
        await NewPasskeys().AddAsync(APasskey(Bob, id: 3, name: "Another user"), CancellationToken.None);

        var list = await NewPasskeys().ListAsync(Alice, CancellationToken.None);

        Assert.That(list.Select(p => p.Name), Is.EqualTo(new[] { "Laptop", "Phone" }), "Alice has two, the one registered first at the top, and none of the other user's");
    }

    [Test]
    public async Task RecordingAUse_KeepsTheNewCounter_AndWhenItWas()
    {
        await NewPasskeys().AddAsync(APasskey(), CancellationToken.None);
        var at = TestClock.Now.AddHours(1);

        await NewPasskeys().RecordUseAsync([1, 2, 3], 42, at, CancellationToken.None);
        var found = await NewPasskeys().FindAsync([1, 2, 3], CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(found?.SignCount, Is.EqualTo(42u), "the device's counter");
            Assert.That(found?.LastUsedAt, Is.EqualTo(at), "when it signed in");
        });
    }

    [Test]
    public async Task APasskey_IsDeletedByItsOwner_AndNotByAnyoneElse()
    {
        await NewPasskeys().AddAsync(APasskey(), CancellationToken.None);

        var byBob = await NewPasskeys().DeleteAsync(Bob, [1, 2, 3], CancellationToken.None);
        var stillThere = await NewPasskeys().FindAsync([1, 2, 3], CancellationToken.None);
        var byAlice = await NewPasskeys().DeleteAsync(Alice, [1, 2, 3], CancellationToken.None);
        var gone = await NewPasskeys().FindAsync([1, 2, 3], CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(byBob, Is.False, "the other user has no such passkey");
            Assert.That(stillThere, Is.Not.Null, "so it stays");
            Assert.That(byAlice, Is.True, "its owner can delete it");
            Assert.That(gone, Is.Null, "and it is gone");
        });
    }
}
