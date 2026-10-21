using Microsoft.EntityFrameworkCore;
using MortgageAnalytics.Application.Sessions;

namespace MortgageAnalytics.Infrastructure.Tests;

/// <summary>
/// The record of where each user is signed in: one row per sign-in, found by its id, listed newest-used first, and ended
/// by deleting it. Everything works only on the owner's own rows, and they go when the user does.
/// </summary>
[TestFixture]
public class UserSessionRepositoryTests : RepositoryTestBase
{
    private static readonly TimeSpan Fortnight = TimeSpan.FromDays(14);

    private static UserSession ASession(string owner = Alice, string device = "Chrome on Windows", int minutesLater = 0, Guid? id = null) => new()
    {
        Id = id ?? Guid.NewGuid(), OwnerId = owner, Device = device, CreatedAt = TestClock.Now.AddMinutes(minutesLater), LastSeenAt = TestClock.Now.AddMinutes(minutesLater),
    };

    [Test]
    public async Task ASession_IsListedWithEverythingKept()
    {
        var session = ASession();
        await NewSessions().AddAsync(session, CancellationToken.None);

        var listed = await NewSessions().ListAsync(Alice, TestClock.Now - Fortnight, CancellationToken.None);

        Assert.Multiple(() =>
        {
            Assert.That(listed, Has.Count.EqualTo(1), "one sign-in");
            Assert.That(listed[0].Id, Is.EqualTo(session.Id), "its id");
            Assert.That(listed[0].Device, Is.EqualTo("Chrome on Windows"), "the device it was from");
            Assert.That(listed[0].CreatedAt, Is.EqualTo(TestClock.Now), "when it began");
            Assert.That(listed[0].LastSeenAt, Is.EqualTo(TestClock.Now), "when it was last used");
        });
    }

    [Test]
    public async Task TheList_HasTheMostRecentlyUsedFirst_AndOnlyTheOwners()
    {
        await NewSessions().AddAsync(ASession(device: "Old phone", minutesLater: 0), CancellationToken.None);
        await NewSessions().AddAsync(ASession(device: "Laptop", minutesLater: 30), CancellationToken.None);
        await NewSessions().AddAsync(ASession(Bob, "Bob's laptop", 60), CancellationToken.None);

        var listed = await NewSessions().ListAsync(Alice, TestClock.Now - Fortnight, CancellationToken.None);

        Assert.That(listed.Select(s => s.Device), Is.EqualTo(new[] { "Laptop", "Old phone" }), "newest used first, and not Bob's");
    }

    [Test]
    public async Task ASessionNotUsedSinceTheCookieWouldHaveExpired_IsLeftOutOfTheList_AndRemoved()
    {
        await NewSessions().AddAsync(ASession(device: "Forgotten"), CancellationToken.None);
        await NewSessions().AddAsync(ASession(device: "Recent", minutesLater: 20 * 24 * 60), CancellationToken.None);

        var listed = await NewSessions().ListAsync(Alice, TestClock.Now.AddDays(20) - Fortnight, CancellationToken.None);

        Assert.Multiple(async () =>
        {
            Assert.That(listed.Select(s => s.Device), Is.EqualTo(new[] { "Recent" }), "its cookie has expired, so it is not a place you are signed in");
            Assert.That(await NewContext().Set<UserSession>().CountAsync(), Is.EqualTo(1), "and its row is cleared away");
        });
    }

    [Test]
    public async Task Touching_ASessionThatExists_SaysSo_AndRecordsUseOnlyWhenTheLastWasLongAgo()
    {
        var session = ASession();
        await NewSessions().AddAsync(session, CancellationToken.None);
        var refresh = TimeSpan.FromMinutes(5);

        var soon = await NewSessions().TouchAsync(session.Id, Alice, TestClock.Now.AddMinutes(2), refresh, CancellationToken.None);
        var afterSoon = (await NewSessions().ListAsync(Alice, TestClock.Now - Fortnight, CancellationToken.None))[0].LastSeenAt;
        var later = await NewSessions().TouchAsync(session.Id, Alice, TestClock.Now.AddMinutes(10), refresh, CancellationToken.None);
        var afterLater = (await NewSessions().ListAsync(Alice, TestClock.Now - Fortnight, CancellationToken.None))[0].LastSeenAt;

        Assert.Multiple(() =>
        {
            Assert.That(new[] { soon, later }, Is.All.True, "the session is still there");
            Assert.That(afterSoon, Is.EqualTo(TestClock.Now), "two minutes on is not recorded: that would be a write on every request");
            Assert.That(afterLater, Is.EqualTo(TestClock.Now.AddMinutes(10)), "ten minutes on is");
        });
    }

    [Test]
    public async Task Touching_ASessionThatWasEnded_OrIsAnothersOrUnknown_SaysItIsGone()
    {
        var session = ASession();
        await NewSessions().AddAsync(session, CancellationToken.None);
        await NewSessions().DeleteAsync(Alice, session.Id, CancellationToken.None);

        Assert.Multiple(async () =>
        {
            Assert.That(await NewSessions().TouchAsync(session.Id, Alice, TestClock.Now, TimeSpan.Zero, CancellationToken.None), Is.False, "ended");
            Assert.That(await NewSessions().TouchAsync(Guid.NewGuid(), Alice, TestClock.Now, TimeSpan.Zero, CancellationToken.None), Is.False, "never was");
        });
    }

    [Test]
    public async Task OneUser_CannotTouchOrEnd_Another_UsersSession()
    {
        var session = ASession();
        await NewSessions().AddAsync(session, CancellationToken.None);

        Assert.Multiple(async () =>
        {
            Assert.That(await NewSessions().TouchAsync(session.Id, Bob, TestClock.Now, TimeSpan.Zero, CancellationToken.None), Is.False, "it is not Bob's to keep");
            Assert.That(await NewSessions().DeleteAsync(Bob, session.Id, CancellationToken.None), Is.False, "nor to end");
            Assert.That(await NewSessions().ListAsync(Alice, TestClock.Now - Fortnight, CancellationToken.None), Has.Count.EqualTo(1), "so it is still Alice's");
        });
    }

    [Test]
    public async Task EndingAllTheOthers_KeepsTheOneNamed_AndSaysHowManyWentOnlyOfTheOwners()
    {
        var keep = ASession(device: "This one");
        await NewSessions().AddAsync(keep, CancellationToken.None);
        await NewSessions().AddAsync(ASession(device: "Phone"), CancellationToken.None);
        await NewSessions().AddAsync(ASession(device: "Tablet"), CancellationToken.None);
        await NewSessions().AddAsync(ASession(Bob, "Bob's"), CancellationToken.None);

        var ended = await NewSessions().DeleteOthersAsync(Alice, keep.Id, CancellationToken.None);

        Assert.Multiple(async () =>
        {
            Assert.That(ended, Is.EqualTo(2), "the phone and the tablet");
            Assert.That((await NewSessions().ListAsync(Alice, TestClock.Now - Fortnight, CancellationToken.None)).Select(s => s.Device), Is.EqualTo(new[] { "This one" }), "this one stays");
            Assert.That(await NewSessions().ListAsync(Bob, TestClock.Now - Fortnight, CancellationToken.None), Has.Count.EqualTo(1), "and Bob's is not touched");
        });
    }

    [Test]
    public async Task DeletingAUser_EndsTheirSessions()
    {
        await NewSessions().AddAsync(ASession(), CancellationToken.None);
        await using (var context = NewContext())
        {
            context.Users.Remove(await context.Users.SingleAsync(u => u.Id == Alice));
            await context.SaveChangesAsync();
        }

        Assert.That(await NewContext().Set<UserSession>().CountAsync(), Is.EqualTo(0), "a deleted account is signed in nowhere");
    }
}
