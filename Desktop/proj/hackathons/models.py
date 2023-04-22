from django.db import models
from django.template.defaultfilters import slugify

# Create your models here.
class Hackathon(models.Model):
    name = models.CharField(max_length=255)
    image=models.ImageField(upload_to='images/',default='images/None/no-img.jpg')
    venue = models.CharField(max_length=255)
    prize_money = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField()
    date=models.DateField()
    Apply = models.URLField()
    def __str__(self):
        return self.name

class Fest(models.Model):
    name=models.CharField(max_length=255)
    venue=models.CharField(max_length=255)
    description=models.TextField()
    checkout=models.URLField()
    def __str__(self):
        return self.name
    
class Esummit(models.Model):
    name=models.CharField(max_length=255)
    venue=models.CharField(max_length=255)
    description=models.TextField()
    checkout=models.URLField()
    def __str__(self):
        return self.name
    

class teammatesearch(models.Model):
    
    hackathon_name=models.CharField(max_length=255,default='hackathon team')
    team=models.CharField(max_length=255,default='team')
    name=models.CharField(max_length=255)
    email=models.EmailField()
    phone=models.CharField(max_length=255)
    github1=models.CharField(max_length=255)
    name2=models.CharField(max_length=255,blank=True)
    email2=models.EmailField(blank=True)
    phone2=models.CharField(max_length=255,default='0',blank=True)
    github2=models.CharField(max_length=255,blank=True)
    name3=models.CharField(max_length=255,blank=True)
    email3=models.EmailField(blank=True)
    phone3=models.CharField(max_length=255,default='0',blank=True)
    github3=models.CharField(max_length=255,blank=True)
    slug=models.CharField(max_length=255,null=True,blank=True)
    
    def __str__(self):
        return self.name
    def save(self, *args, **kwargs):
        if not self.slug:
           self.slug=slugify(self.name+"-"+str(self.team))
        return super().save(*args,**kwargs)



class  team_requests(models.Model):
    name=models.CharField(max_length=255,default='name')
    hacakthon_name=models.CharField(max_length=255)
    user_id=models.CharField(max_length=255)
    user_id_rec=models.CharField(max_length=255)
    github_username=models.CharField(max_length=255)
    def __str__(self):
        return self.name
    
class userid_githubuser(models.Model):
    name=models.CharField(max_length=255,default='name')
    user_id=models.CharField(max_length=255)
    github_username=models.CharField(max_length=255)
    def __str__(self):
        return self.name
